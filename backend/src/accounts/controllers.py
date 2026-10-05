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
    ResendVerificationIn,
    ResentOut,
    ResetPasswordIn,
    SessionOut,
    SignupIn,
    TokenPairOut,
    UserOut,
    VerifyEmailIn,
    VerifyIn,
    VerifyOut,
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
        user = build_signup_service().signup(
            SignupCommand(
                email=payload.email,
                password=payload.password,
                first_name=payload.first_name,
                last_name=payload.last_name,
                phone=payload.phone,
            )
        )
        return status.HTTP_201_CREATED, success("Account created.", asdict(user))

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
        build_signup_service().resend(email=payload.email)
        return success("If an account needs verification, a new link was sent.", {"sent": True})

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
