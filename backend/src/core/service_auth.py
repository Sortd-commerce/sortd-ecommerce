"""Verify client-issued service JWTs. Django never signs these tokens."""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

import jwt
from django.conf import settings
from jwt import InvalidTokenError


class ServiceTokenError(Exception):
    pass


@dataclass(frozen=True)
class ServiceIdentity:
    issuer: str
    audience: str
    token_use: str


class ServiceTokenVerifier(Protocol):
    def verify(self, token: str) -> ServiceIdentity: ...


class PyJwtServiceTokenVerifier:
    def verify(self, token: str) -> ServiceIdentity:
        try:
            header = jwt.get_unverified_header(token)
        except InvalidTokenError as exc:
            raise ServiceTokenError("Invalid service token.") from exc
        if header.get("alg") != "HS256":
            raise ServiceTokenError("Invalid service token.")

        try:
            payload = jwt.decode(
                token,
                settings.SERVICE_SIGNING_KEY,
                algorithms=["HS256"],
                audience=settings.SERVICE_TOKEN_AUDIENCE,
                options={
                    "require": ["iss", "aud", "exp", "iat", "nbf", "token_use"],
                    "verify_iss": False,
                },
            )
        except InvalidTokenError as exc:
            raise ServiceTokenError("Invalid service token.") from exc

        issuer = str(payload.get("iss") or "")
        allowed = set(settings.SERVICE_TOKEN_ISSUERS)
        if issuer not in allowed:
            raise ServiceTokenError("Invalid service token.")
        if payload.get("token_use") != "service":
            raise ServiceTokenError("Invalid service token.")

        issued_at = _as_datetime(payload["iat"])
        expires_at = _as_datetime(payload["exp"])
        lifetime = (expires_at - issued_at).total_seconds()
        if lifetime <= 0 or lifetime > settings.SERVICE_TOKEN_MAX_SECONDS:
            raise ServiceTokenError("Invalid service token.")

        return ServiceIdentity(
            issuer=issuer,
            audience=str(payload["aud"]),
            token_use="service",
        )


def _as_datetime(value) -> datetime:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    return datetime.fromtimestamp(int(value), tz=timezone.utc)
