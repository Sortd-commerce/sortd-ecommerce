import hashlib
import hmac
import logging
import secrets
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import update_last_login
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from ninja_extra import exceptions
from ninja_jwt.exceptions import TokenError
from ninja_jwt.tokens import UntypedToken

from accounts.emailing import EmailSendError, unwrap_verification_token
from accounts.models import DeviceSession, EmailVerification
from accounts.tokens import AppRefreshToken
from accounts.types import (
    AuthResult,
    DeviceSnapshot,
    EmailSender,
    LoginCommand,
    ProfileUpdateCommand,
    SignupCommand,
    TokenIssuer,
    TokenPair,
    UserSnapshot,
)
from accounts.sessions import open_session, require_active_session, revoke_session, touch_session
from core.clock import Clock
from core.exceptions import ServiceUnavailable
from core.messages import ErrorMessage

User = get_user_model()
logger = logging.getLogger(__name__)


class JwtTokenIssuer:
    def issue(self, user, session_id: int | None = None) -> TokenPair:
        refresh = AppRefreshToken.for_user(user, session_id=session_id)
        return TokenPair(access=str(refresh.access_token), refresh=str(refresh))


def issue_auth(
    *,
    user,
    tokens: TokenIssuer,
    request,
    device_id: str = "",
    email_sender: EmailSender | None = None,
    notify_new: bool = False,
) -> AuthResult:
    session, is_new = open_session(user=user, request=request, device_id=device_id, refresh_jti="")
    pair = tokens.issue(user, session_id=session.pk)
    refresh = AppRefreshToken(pair.refresh)
    session.refresh_jti = str(refresh["jti"])
    session.save(update_fields=["refresh_jti"])
    had_other = DeviceSession.objects.filter(user=user).exclude(pk=session.pk).exists()
    if notify_new and is_new and had_other and email_sender is not None:
        try:
            email_sender.send_new_device_login(
                to=user.email,
                first_name=user.first_name,
                label=session.label,
                ip_address=session.ip_address,
            )
        except EmailSendError:
            logger.exception("New-device email failed for user %s", user.pk)
    return AuthResult(
        user=snapshot(user),
        tokens=pair,
        device=DeviceSnapshot(id=session.device_id, label=session.label, is_new=is_new),
    )


class SignupService:
    def __init__(self, *, clock: Clock, email_sender: EmailSender, tokens: TokenIssuer) -> None:
        self._clock = clock
        self._email_sender = email_sender
        self._tokens = tokens

    def signup(self, command: SignupCommand) -> UserSnapshot:
        email = command.email
        try:
            with transaction.atomic():
                user = User.objects.select_for_update().filter(email=email).first()
                if user is None:
                    candidate = User(
                        email=email,
                        first_name=command.first_name,
                        last_name=command.last_name,
                        phone=command.phone,
                    )
                    try:
                        validate_password(command.password, user=candidate)
                    except DjangoValidationError as exc:
                        raise exceptions.ValidationError({"password": exc.messages}) from exc
                    try:
                        user = User.objects.create_user(
                            email=email,
                            password=command.password,
                            first_name=command.first_name,
                            last_name=command.last_name,
                            phone=command.phone,
                        )
                    except IntegrityError as exc:
                        raise exceptions.ValidationError(
                            {"email": "An account with this email already exists."}
                        ) from exc
                elif user.email_verified_at is not None:
                    raise exceptions.ValidationError(
                        {"email": "An account with this email already exists."}
                    )
                else:
                    try:
                        validate_password(command.password, user=user)
                    except DjangoValidationError as exc:
                        raise exceptions.ValidationError({"password": exc.messages}) from exc
                    user.set_password(command.password)
                    user.first_name = command.first_name
                    user.last_name = command.last_name
                    user.phone = command.phone
                    user.save(update_fields=["password", "first_name", "last_name", "phone"])

                raw_token = self._issue_token(user, kind=EmailVerification.Kind.VERIFY)
        except (exceptions.ValidationError, ServiceUnavailable):
            raise

        try:
            self._email_sender.send_verification(
                to=user.email, link=self._link("/verify-email", raw_token), first_name=user.first_name
            )
        except EmailSendError as exc:
            raise ServiceUnavailable(str(exc)) from exc
        return snapshot(user)

    def resend(self, *, email: str) -> None:
        user = User.objects.filter(email=email, email_verified_at__isnull=True, is_active=True).first()
        if user is None:
            return
        raw_token = self._issue_token(user, kind=EmailVerification.Kind.VERIFY)
        try:
            self._email_sender.send_verification(
                to=user.email, link=self._link("/verify-email", raw_token), first_name=user.first_name
            )
        except EmailSendError as exc:
            raise ServiceUnavailable(str(exc)) from exc

    def verify(self, *, raw_token: str, request=None, device_id: str = "") -> AuthResult:
        digest = hash_token(unwrap_verification_token(raw_token))
        now = self._clock.now()
        with transaction.atomic():
            updated = EmailVerification.objects.filter(
                token_hash=digest,
                kind=EmailVerification.Kind.VERIFY,
                used_at__isnull=True,
                revoked_at__isnull=True,
                expires_at__gt=now,
            ).update(used_at=now)
            if updated != 1:
                raise exceptions.AuthenticationFailed(ErrorMessage.INVALID_VERIFICATION)
            row = EmailVerification.objects.select_related("user").get(token_hash=digest)
            if not hmac.compare_digest(row.token_hash, digest):
                raise exceptions.AuthenticationFailed(ErrorMessage.INVALID_VERIFICATION)
            user = row.user
            if not user.is_active:
                raise exceptions.AuthenticationFailed(ErrorMessage.INVALID_VERIFICATION)
            if user.email_verified_at is None:
                user.email_verified_at = now
                user.save(update_fields=["email_verified_at"])
        update_last_login(None, user)
        if request is None:
            return AuthResult(user=snapshot(user), tokens=self._tokens.issue(user))
        return issue_auth(
            user=user,
            tokens=self._tokens,
            request=request,
            device_id=device_id,
            email_sender=self._email_sender,
            notify_new=False,
        )

    def request_password_reset(self, *, email: str) -> None:
        user = User.objects.filter(email=email, is_active=True, email_verified_at__isnull=False).first()
        if user is None:
            return
        raw_token = self._issue_token(user, kind=EmailVerification.Kind.RESET)
        try:
            self._email_sender.send_password_reset(
                to=user.email, link=self._link("/reset-password", raw_token), first_name=user.first_name
            )
        except EmailSendError as exc:
            raise ServiceUnavailable(str(exc)) from exc

    def reset_password(self, *, raw_token: str, new_password: str) -> None:
        digest = hash_token(unwrap_verification_token(raw_token))
        now = self._clock.now()
        with transaction.atomic():
            row = (
                EmailVerification.objects.select_related("user")
                .filter(
                    token_hash=digest,
                    kind=EmailVerification.Kind.RESET,
                    used_at__isnull=True,
                    revoked_at__isnull=True,
                    expires_at__gt=now,
                )
                .first()
            )
            if row is None:
                raise exceptions.ValidationError({"token": ErrorMessage.INVALID_VERIFICATION})
            user = row.user
            try:
                validate_password(new_password, user=user)
            except DjangoValidationError as exc:
                raise exceptions.ValidationError({"password": exc.messages}) from exc
            user.set_password(new_password)
            user.save(update_fields=["password"])
            row.used_at = now
            row.save(update_fields=["used_at"])
            EmailVerification.objects.filter(
                user=user, kind=EmailVerification.Kind.RESET, used_at__isnull=True
            ).exclude(pk=row.pk).update(revoked_at=now)

    def _issue_token(self, user, *, kind: str) -> str:
        now = self._clock.now()
        minutes = (
            settings.PASSWORD_RESET_MINUTES
            if kind == EmailVerification.Kind.RESET
            else settings.EMAIL_VERIFICATION_MINUTES
        )
        EmailVerification.objects.filter(
            user=user, kind=kind, used_at__isnull=True, revoked_at__isnull=True
        ).update(revoked_at=now)
        raw = secrets.token_urlsafe(32)
        EmailVerification.objects.create(
            user=user,
            kind=kind,
            token_hash=hash_token(raw),
            expires_at=now + timedelta(minutes=minutes),
        )
        return raw

    def _link(self, path: str, raw_token: str) -> str:
        query = urlencode({"token": raw_token})
        return f"{settings.FRONTEND_URL}{path}?{query}"


class LoginService:
    def __init__(self, *, tokens: TokenIssuer, email_sender: EmailSender) -> None:
        self._tokens = tokens
        self._email_sender = email_sender

    def login(self, *, request, command: LoginCommand) -> AuthResult:
        user = authenticate(request, email=command.email, password=command.password)
        if user is None or not user.is_active:
            raise exceptions.AuthenticationFailed(ErrorMessage.INVALID_CREDENTIALS)
        if user.email_verified_at is None:
            raise exceptions.AuthenticationFailed(ErrorMessage.EMAIL_NOT_VERIFIED)
        update_last_login(None, user)
        return issue_auth(
            user=user,
            tokens=self._tokens,
            request=request,
            device_id=command.device_id,
            email_sender=self._email_sender,
            notify_new=True,
        )


class TokenService:
    def __init__(self, *, tokens: TokenIssuer | None = None) -> None:
        self._tokens = tokens or JwtTokenIssuer()

    def refresh(self, *, refresh: str, request=None) -> TokenPair:
        try:
            previous = AppRefreshToken(refresh)
            user_id = previous["user_id"]
            session_id = previous.get("session_id")
            previous.blacklist()
        except TokenError as exc:
            raise exceptions.AuthenticationFailed("Token is invalid or expired.") from exc
        try:
            user = User.objects.get(pk=user_id, is_active=True)
        except User.DoesNotExist as exc:
            raise exceptions.AuthenticationFailed("Token is invalid or expired.") from exc
        if session_id is not None:
            session = require_active_session(user=user, session_id=session_id)
            issued = self._tokens.issue(user, session_id=session.pk)
            rotated = AppRefreshToken(issued.refresh)
            if request is not None:
                touch_session(session, request=request, refresh_jti=str(rotated["jti"]))
            else:
                session.refresh_jti = str(rotated["jti"])
                session.save(update_fields=["refresh_jti"])
            return issued
        return self._tokens.issue(user)

    def verify_access(self, *, token: str) -> dict:
        try:
            UntypedToken(token)
        except TokenError as exc:
            raise exceptions.AuthenticationFailed("Token is invalid or expired.") from exc
        return {"valid": True}

    def logout(self, *, refresh: str) -> None:
        try:
            token = AppRefreshToken(refresh)
            session_id = token.get("session_id")
            user_id = token["user_id"]
            token.blacklist()
        except TokenError as exc:
            raise exceptions.AuthenticationFailed("Token is invalid or expired.") from exc
        if session_id is not None:
            session = DeviceSession.objects.filter(pk=session_id, user_id=user_id).first()
            if session is not None:
                revoke_session(session)


class ProfileService:
    def update(self, user, command: ProfileUpdateCommand):
        fields = []
        if command.first_name is not None:
            user.first_name = command.first_name.strip()
            fields.append("first_name")
        if command.last_name is not None:
            user.last_name = command.last_name.strip()
            fields.append("last_name")
        if command.phone is not None:
            user.phone = command.phone
            fields.append("phone")
        if fields:
            user.save(update_fields=fields)
        return user

    def change_password(self, user, *, current_password: str, new_password: str) -> None:
        if not user.check_password(current_password):
            raise exceptions.ValidationError({"current_password": "Current password is incorrect."})
        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            raise exceptions.ValidationError({"new_password": exc.messages}) from exc
        user.set_password(new_password)
        user.save(update_fields=["password"])


def snapshot(user) -> UserSnapshot:
    return UserSnapshot(
        id=user.pk,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        email_verified_at=user.email_verified_at,
        date_joined=user.date_joined,
    )


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
