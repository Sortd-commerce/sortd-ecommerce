import hashlib
import hmac
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
from accounts.models import EmailVerification
from accounts.tokens import AppRefreshToken
from accounts.types import (
    AuthResult,
    EmailSender,
    LoginCommand,
    ProfileUpdateCommand,
    SignupCommand,
    TokenIssuer,
    TokenPair,
    UserSnapshot,
)
from core.clock import Clock
from core.exceptions import ServiceUnavailable
from core.messages import ErrorMessage

User = get_user_model()


class JwtTokenIssuer:
    def issue(self, user) -> TokenPair:
        refresh = AppRefreshToken.for_user(user)
        return TokenPair(access=str(refresh.access_token), refresh=str(refresh))


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

                raw_token = self._issue_verification(user)
        except (exceptions.ValidationError, ServiceUnavailable):
            raise

        try:
            self._email_sender.send_verification(to=user.email, link=self._verification_link(raw_token))
        except EmailSendError as exc:
            raise ServiceUnavailable(str(exc)) from exc
        return snapshot(user)

    def resend(self, *, email: str) -> None:
        user = User.objects.filter(email=email, email_verified_at__isnull=True, is_active=True).first()
        if user is None:
            return
        raw_token = self._issue_verification(user)
        try:
            self._email_sender.send_verification(to=user.email, link=self._verification_link(raw_token))
        except EmailSendError as exc:
            raise ServiceUnavailable(str(exc)) from exc

    def verify(self, *, raw_token: str) -> AuthResult:
        digest = hash_token(unwrap_verification_token(raw_token))
        now = self._clock.now()
        with transaction.atomic():
            updated = EmailVerification.objects.filter(
                token_hash=digest,
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
        return AuthResult(user=snapshot(user), tokens=self._tokens.issue(user))

    def _issue_verification(self, user) -> str:
        now = self._clock.now()
        EmailVerification.objects.filter(
            user=user, used_at__isnull=True, revoked_at__isnull=True
        ).update(revoked_at=now)
        raw = secrets.token_urlsafe(32)
        EmailVerification.objects.create(
            user=user,
            token_hash=hash_token(raw),
            expires_at=now + timedelta(minutes=settings.EMAIL_VERIFICATION_MINUTES),
        )
        return raw

    def _verification_link(self, raw_token: str) -> str:
        query = urlencode({"token": raw_token})
        return f"{settings.FRONTEND_URL}/verify-email?{query}"


class LoginService:
    def __init__(self, *, tokens: TokenIssuer) -> None:
        self._tokens = tokens

    def login(self, *, request, command: LoginCommand) -> AuthResult:
        user = authenticate(request, email=command.email, password=command.password)
        if user is None or not user.is_active:
            raise exceptions.AuthenticationFailed(ErrorMessage.INVALID_CREDENTIALS)
        if user.email_verified_at is None:
            raise exceptions.AuthenticationFailed(ErrorMessage.EMAIL_NOT_VERIFIED)
        update_last_login(None, user)
        return AuthResult(user=snapshot(user), tokens=self._tokens.issue(user))


class TokenService:
    def refresh(self, *, refresh: str) -> TokenPair:
        try:
            previous = AppRefreshToken(refresh)
            user_id = previous["user_id"]
            previous.blacklist()
        except TokenError as exc:
            raise exceptions.AuthenticationFailed("Token is invalid or expired.") from exc
        try:
            user = User.objects.get(pk=user_id, is_active=True)
        except User.DoesNotExist as exc:
            raise exceptions.AuthenticationFailed("Token is invalid or expired.") from exc
        issued = JwtTokenIssuer().issue(user)
        return issued

    def verify_access(self, *, token: str) -> dict:
        try:
            UntypedToken(token)
        except TokenError as exc:
            raise exceptions.AuthenticationFailed("Token is invalid or expired.") from exc
        return {"valid": True}

    def logout(self, *, refresh: str) -> None:
        try:
            AppRefreshToken(refresh).blacklist()
        except TokenError as exc:
            raise exceptions.AuthenticationFailed("Token is invalid or expired.") from exc


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
