from ninja_jwt.authentication import JWTAuth
from ninja_jwt.exceptions import InvalidToken

from accounts.models import DeviceSession
from core.messages import ErrorMessage


class SessionJWTAuth(JWTAuth):
    def jwt_authenticate(self, request, token: str):
        user = super().jwt_authenticate(request, token)
        validated = self.get_validated_token(token)
        session_id = validated.get("session_id")
        if session_id is None:
            return user
        if not DeviceSession.objects.filter(pk=session_id, user=user, revoked_at__isnull=True).exists():
            raise InvalidToken(ErrorMessage.UNAUTHORIZED)
        return user
