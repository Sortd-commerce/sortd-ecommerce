"""Require a storefront service JWT on every customer API route."""

from django.conf import settings
from django.http import JsonResponse

from config.environment import LOCAL
from core.messages import ErrorMessage
from core.responses import error
from core.service_auth import PyJwtServiceTokenVerifier, ServiceTokenError

_verifier = PyJwtServiceTokenVerifier()


class ServiceTokenMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if _requires_service_token(request.path):
            raw = request.headers.get("X-Service-Token", "").strip()
            if not raw:
                return _unauthorized()
            try:
                request.service_identity = _verifier.verify(raw)
            except ServiceTokenError:
                return _unauthorized()
        return self.get_response(request)


def _requires_service_token(path: str) -> bool:
    if not path.startswith("/api/v1/"):
        return False
    if settings.ENVIRONMENT == LOCAL and path in {"/api/v1/docs", "/api/v1/docs/", "/api/v1/openapi.json"}:
        return False
    return True


def _unauthorized() -> JsonResponse:
    return JsonResponse(error(ErrorMessage.UNAUTHORIZED, "unauthorized"), status=401)
