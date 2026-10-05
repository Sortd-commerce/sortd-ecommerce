from ninja_jwt.exceptions import TokenError
from ninja_jwt.tokens import AccessToken, RefreshToken


class AppAccessToken(AccessToken):
    def verify(self) -> None:
        super().verify()
        if self.payload.get("token_use") != "access":
            raise TokenError("Token is invalid or expired")


class AppRefreshToken(RefreshToken):
    access_token_class = AppAccessToken

    @classmethod
    def for_user(cls, user, session_id: int | None = None):
        token = super().for_user(user)
        if session_id is not None:
            token["session_id"] = session_id
        return token

    @property
    def access_token(self) -> AppAccessToken:
        access = super().access_token
        access["token_use"] = "access"
        session_id = self.payload.get("session_id")
        if session_id is not None:
            access["session_id"] = session_id
        return access
