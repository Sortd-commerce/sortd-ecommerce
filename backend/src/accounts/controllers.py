from ninja_extra import ControllerBase, api_controller, route, status
from ninja_extra.permissions import AllowAny, IsAuthenticated
from accounts.auth import SessionJWTAuth

from accounts.factory import (
    build_login_service,
    build_profile_service,
    build_signup_service,
    build_token_service,
)
from accounts.schemas import (
    AuthOut,
    ForgotPasswordIn,
    LoggedOutOut,
    LoginIn,
    PasswordChangedOut,
    PasswordChangeIn,
    ProfileUpdateIn,
    RefreshIn,
    RequestLoginCodeIn,
    ResendCodeIn,
    ResendVerificationIn,
    ResentOut,
    ResetPasswordIn,
    SessionOut,
    SignupIn,
    TokenPairOut,
    UserOut,
    VerifyCodeIn,
    VerifyEmailIn,
    VerifyIn,
    VerifyOut,
    split_full_name,
)
from dataclasses import asdict

from accounts.types import LoginCommand, ProfileUpdateCommand, SignupCommand
from core.responses import ErrorResponse, SuccessResponse, success
from core.throttling import AuthThrottle, PasswordResetThrottle, ResendThrottle, SignupThrottle, VerifyThrottle

_ERROR_RESPONSES = {
    400: ErrorResponse,
    401: ErrorResponse,
    403: ErrorResponse,
    422: ErrorResponse,
    429: ErrorResponse,
    503: ErrorResponse,
}


@api_controller(
    "/auth",
    tags=["Authentication"],
    auth=None,
    permissions=[AllowAny],
    throttle=[AuthThrottle()],
    use_unique_op_id=False,
)
class AuthController(ControllerBase):
    @route.post(
        "/signup",
        response={201: SuccessResponse[UserOut], **_ERROR_RESPONSES},
        summary="Create an account",
        throttle=[SignupThrottle()],
    )
    def signup(self, payload: SignupIn):
        first_name, last_name = split_full_name(payload.full_name)
        user = build_signup_service().signup(
            SignupCommand(
                email=payload.email,
                first_name=first_name,
                last_name=last_name,
                phone=payload.phone,
            )
        )
        return status.HTTP_201_CREATED, success("Check your email for a code.", asdict(user))

    @route.post(
        "/verify-email",
        response={200: SuccessResponse[AuthOut], **_ERROR_RESPONSES},
        summary="Verify an email with a magic-link token",
        throttle=[VerifyThrottle()],
    )
    def verify_email(self, payload: VerifyEmailIn):
        result = build_signup_service().verify(
            raw_token=payload.token,
            request=self.context.request,
            device_id=payload.device_id,
        )
        return success("Email verified.", asdict(result))

    @route.post(
        "/resend-verification",
        response={200: SuccessResponse[ResentOut], **_ERROR_RESPONSES},
        summary="Resend the email verification link",
        throttle=[ResendThrottle()],
    )
    def resend_verification(self, payload: ResendVerificationIn):
        build_signup_service().resend(email=payload.email, purpose="signup")
        return success("If an account needs verification, a new code was sent.", {"sent": True})

    @route.post(
        "/resend-code",
        response={200: SuccessResponse[ResentOut], **_ERROR_RESPONSES},
        summary="Resend a signup or login code",
        throttle=[ResendThrottle()],
    )
    def resend_code(self, payload: ResendCodeIn):
        build_signup_service().resend(email=payload.email, purpose=payload.purpose)
        return success("If that account exists, a new code was sent.", {"sent": True})

    @route.post(
        "/signup/verify",
        response={200: SuccessResponse[AuthOut], **_ERROR_RESPONSES},
        summary="Verify signup with a 6-digit email code",
        throttle=[VerifyThrottle()],
    )
    def verify_signup_code(self, payload: VerifyCodeIn):
        from accounts.models import EmailVerification

        result = build_signup_service().verify_code(
            email=payload.email,
            code=payload.code,
            request=self.context.request,
            device_id=payload.device_id,
            kind=EmailVerification.Kind.VERIFY,
        )
        return success("Account created.", asdict(result))

    @route.post(
        "/login/code",
        response={200: SuccessResponse[ResentOut], **_ERROR_RESPONSES},
        summary="Send a login code to a verified email",
        throttle=[ResendThrottle()],
    )
    def request_login_code(self, payload: RequestLoginCodeIn):
        build_login_service().request_code(email=payload.email)
        return success("If that account exists, a login code was sent.", {"sent": True})

    @route.post(
        "/login/verify",
        response={200: SuccessResponse[AuthOut], **_ERROR_RESPONSES},
        summary="Log in with a 6-digit email code",
        throttle=[VerifyThrottle()],
    )
    def verify_login_code(self, payload: VerifyCodeIn):
        from accounts.models import EmailVerification

        result = build_signup_service().verify_code(
            email=payload.email,
            code=payload.code,
            request=self.context.request,
            device_id=payload.device_id,
            kind=EmailVerification.Kind.LOGIN,
        )
        return success("Logged in.", asdict(result))

    @route.post(
        "/forgot-password",
        response={200: SuccessResponse[ResentOut], **_ERROR_RESPONSES},
        summary="Request a password reset email",
        throttle=[PasswordResetThrottle()],
    )
    def forgot_password(self, payload: ForgotPasswordIn):
        build_signup_service().request_password_reset(email=payload.email)
        return success("If that account exists, a reset link was sent.", {"sent": True})

    @route.post(
        "/reset-password",
        response={200: SuccessResponse[PasswordChangedOut], **_ERROR_RESPONSES},
        summary="Reset a password with a token",
        throttle=[PasswordResetThrottle()],
    )
    def reset_password(self, payload: ResetPasswordIn):
        build_signup_service().reset_password(raw_token=payload.token, new_password=payload.password)
        return success("Password updated.", {"password_changed": True})

    @route.post(
        "/login",
        response={200: SuccessResponse[AuthOut], **_ERROR_RESPONSES},
        summary="Log in",
    )
    def login(self, payload: LoginIn):
        result = build_login_service().login(
            request=self.context.request,
            command=LoginCommand(email=payload.email, password=payload.password, device_id=payload.device_id),
        )
        return success("Logged in.", asdict(result))

    @route.post(
        "/refresh",
        response={200: SuccessResponse[TokenPairOut], **_ERROR_RESPONSES},
        summary="Refresh an access token",
    )
    def refresh(self, payload: RefreshIn):
        data = build_token_service().refresh(refresh=payload.refresh, request=self.context.request)
        return success("Token refreshed.", asdict(data))

    @route.post(
        "/verify",
        response={200: SuccessResponse[VerifyOut], **_ERROR_RESPONSES},
        summary="Verify a token",
    )
    def verify(self, payload: VerifyIn):
        data = build_token_service().verify_access(token=payload.token)
        return success("Token is valid.", data)

    @route.post(
        "/logout",
        response={200: SuccessResponse[LoggedOutOut], **_ERROR_RESPONSES},
        summary="Revoke a refresh token",
    )
    def logout(self, payload: RefreshIn):
        build_token_service().logout(refresh=payload.refresh)
        return success("Logged out.", {"logged_out": True})


@api_controller(
    "/staff",
    tags=["Staff"],
    auth=None,
    permissions=[AllowAny],
    use_unique_op_id=False,
)
class StaffMeController(ControllerBase):
    @route.get(
        "/me",
        response={200: SuccessResponse, **_ERROR_RESPONSES},
        summary="Current staff profile",
        auth=None,
    )
    def me(self):
        from accounts.auth import SessionJWTAuth
        from accounts.staff import is_staff_user, serialize_staff
        from core.messages import ErrorMessage
        from ninja.errors import HttpError
        from ninja_jwt.exceptions import AuthenticationFailed, InvalidToken

        try:
            header = self.context.request.headers.get("Authorization") or ""
            if not header.lower().startswith("bearer "):
                raise HttpError(401, ErrorMessage.UNAUTHORIZED)
            user = SessionJWTAuth().jwt_authenticate(self.context.request, header.split(" ", 1)[1].strip())
        except (InvalidToken, AuthenticationFailed, HttpError):
            raise HttpError(401, ErrorMessage.UNAUTHORIZED)
        if user is None:
            raise HttpError(401, ErrorMessage.UNAUTHORIZED)
        if not is_staff_user(user):
            raise HttpError(403, "Staff credentials are required.")
        return success("Staff profile retrieved.", serialize_staff(user))


@api_controller(
    "/profile",
    tags=["Profile"],
    auth=SessionJWTAuth(),
    permissions=[IsAuthenticated],
    use_unique_op_id=False,
)
class ProfileController(ControllerBase):
    @route.get(
        "",
        response={200: SuccessResponse[UserOut], **_ERROR_RESPONSES},
        summary="Get the current profile",
    )
    def retrieve(self):
        from accounts.services import snapshot

        return success("Profile retrieved.", asdict(snapshot(self.context.request.user)))

    @route.get(
        "/sessions",
        response={200: SuccessResponse[list[SessionOut]], **_ERROR_RESPONSES},
        summary="List active device sessions",
    )
    def sessions(self):
        from accounts.models import DeviceSession

        rows = DeviceSession.objects.filter(
            user=self.context.request.user, revoked_at__isnull=True
        ).order_by("-last_seen_at")
        current_id = None
        auth = self.context.request.headers.get("Authorization") or ""
        if auth.lower().startswith("bearer "):
            try:
                from accounts.tokens import AppAccessToken

                current_id = AppAccessToken(auth.split(" ", 1)[1]).get("session_id")
            except Exception:
                current_id = None
        data = [
            {
                "device_id": row.device_id,
                "label": row.label,
                "ip_address": row.ip_address,
                "last_seen_at": row.last_seen_at.isoformat(),
                "created_at": row.created_at.isoformat(),
                "current": row.pk == current_id,
            }
            for row in rows
        ]
        return success("Sessions retrieved.", data)

    @route.patch(
        "",
        response={200: SuccessResponse[UserOut], **_ERROR_RESPONSES},
        summary="Update the current profile",
    )
    def update(self, payload: ProfileUpdateIn):
        from accounts.services import snapshot

        user = build_profile_service().update(
            self.context.request.user,
            ProfileUpdateCommand(
                first_name=payload.first_name,
                last_name=payload.last_name,
                phone=payload.phone,
            ),
        )
        return success("Profile updated.", asdict(snapshot(user)))

    @route.post(
        "/password",
        response={200: SuccessResponse[PasswordChangedOut], **_ERROR_RESPONSES},
        summary="Change the current password",
    )
    def change_password(self, payload: PasswordChangeIn):
        build_profile_service().change_password(
            self.context.request.user,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
        return success("Password changed.", {"password_changed": True})
