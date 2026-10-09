from accounts.background_email import build_email_sender
from accounts.services import JwtTokenIssuer, LoginService, ProfileService, SignupService, TokenService
from core.clock import SystemClock


def build_signup_service() -> SignupService:
    return SignupService(clock=SystemClock(), email_sender=build_email_sender(), tokens=JwtTokenIssuer())


def build_login_service() -> LoginService:
    signup = build_signup_service()
    return LoginService(tokens=JwtTokenIssuer(), email_sender=build_email_sender(), signup=signup)


def build_token_service() -> TokenService:
    return TokenService()


def build_profile_service() -> ProfileService:
    return ProfileService()
