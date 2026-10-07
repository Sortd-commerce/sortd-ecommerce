from django.http import HttpRequest
from ninja_jwt.authentication import JWTAuth
from ninja_jwt.exceptions import InvalidToken

from accounts.models import DeviceSession
from core.messages import ErrorMessage


def optional_user(request: HttpRequest):
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return user
    auth_header = request.headers.get("Authorization") or ""
    if not auth_header.lower().startswith("bearer "):
        return None
    try:
        return SessionJWTAuth().jwt_authenticate(request, auth_header.split(" ", 1)[1].strip())
    except InvalidToken:
        return None


class SessionJWTAuth(JWTAuth):
    def jwt_authenticate(self, request, token: str):
        user = super().jwt_authenticate(request, token)
        validated = self.get_validated_token(token)
        session_id = validated.get("session_id")
        if session_id is not None:
            if not DeviceSession.objects.filter(pk=session_id, user=user, revoked_at__isnull=True).exists():
                raise InvalidToken(ErrorMessage.UNAUTHORIZED)
        request.user = user
        return user
