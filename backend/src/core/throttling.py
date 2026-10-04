"""Rate-limit classes. Limits are configured in NINJA_EXTRA['THROTTLE_RATES']."""

from ninja_extra.throttling import AnonRateThrottle, DynamicRateThrottle, UserRateThrottle


class AnonThrottle(AnonRateThrottle):
    scope = "anon"


class UserThrottle(UserRateThrottle):
    scope = "user"


class AuthThrottle(DynamicRateThrottle):
    def __init__(self) -> None:
        super().__init__(scope="auth")


class SignupThrottle(DynamicRateThrottle):
    def __init__(self) -> None:
        super().__init__(scope="signup")


class VerifyThrottle(DynamicRateThrottle):
    def __init__(self) -> None:
        super().__init__(scope="verify")


class ResendThrottle(DynamicRateThrottle):
    def __init__(self) -> None:
        super().__init__(scope="resend")
