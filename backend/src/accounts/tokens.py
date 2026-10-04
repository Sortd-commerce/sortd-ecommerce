from ninja_jwt.exceptions import TokenError
from ninja_jwt.tokens import AccessToken, RefreshToken


class AppAccessToken(AccessToken):
    def verify(self) -> None:
        super().verify()
        if self.payload.get("token_use") != "access":
            raise TokenError("Token is invalid or expired")


class AppRefreshToken(RefreshToken):
    access_token_class = AppAccessToken

    @property
    def access_token(self) -> AppAccessToken:
        access = super().access_token
        access["token_use"] = "access"
        return access
