import re
from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings
from django.core import mail
from django.core.cache import cache
from django.test import Client, TestCase, override_settings

PASSWORD = "Str0ng-pass-99"
NEW_PASSWORD = "N3w-pass-88"
PHONE = "+971501234567"
FULL_NAME = "Ada Lovelace"
_TEST_STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "private": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}


def make_service_token(
    *,
    lifetime_seconds: int = 240,
    signing_key: str | None = None,
    algorithm: str = "HS256",
    payload_updates: dict | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "iss": settings.SERVICE_TOKEN_ISSUER,
        "aud": settings.SERVICE_TOKEN_AUDIENCE,
        "token_use": "service",
        "iat": now,
        "nbf": now,
        "exp": now + timedelta(seconds=lifetime_seconds),
    }
    if payload_updates:
        payload.update(payload_updates)
    return jwt.encode(payload, signing_key or settings.SERVICE_SIGNING_KEY, algorithm=algorithm)


class ServiceClient(Client):
    def generic(self, method, path, data="", content_type="application/octet-stream", secure=False, **extra):
        extra.setdefault("HTTP_X_SERVICE_TOKEN", make_service_token())
        return super().generic(method, path, data, content_type, secure=secure, **extra)


@override_settings(
    MAILERS={
        "default": {"BACKEND": "django.core.mail.backends.locmem.EmailBackend"},
    },
    CLOUDINARY_ENABLED=False,
    STORAGES=_TEST_STORAGES,
)
class ApiTestCase(TestCase):
    client_class = ServiceClient

    def setUp(self):
        super().setUp()
        cache.clear()
        mail.outbox.clear()


def post_json(client, path, payload, **extra):
    return client.post(path, data=payload, content_type="application/json", **extra)


def signup(
    client,
    email="ada@example.com",
    full_name=FULL_NAME,
    phone=PHONE,
):
    return post_json(
        client,
        "/api/v1/auth/signup",
        {
            "email": email,
            "full_name": full_name,
            "phone": phone,
        },
    )


def verification_code_from_mailbox() -> str:
    body = mail.outbox[-1].body
    match = re.search(r"\b(\d{6})\b", body)
    if match is None:
        raise AssertionError("Verification code missing from email.")
    return match.group(1)


def verify_signup(client, email="ada@example.com", code: str | None = None):
    raw = code or verification_code_from_mailbox()
    return post_json(client, "/api/v1/auth/signup/verify", {"email": email, "code": raw})


def signup_and_verify(client, **kwargs):
    created = signup(client, **kwargs)
    if created.status_code != 201:
        return created
    return verify_signup(client, email=kwargs.get("email", "ada@example.com"))


def request_login_code(client, email="ada@example.com"):
    return post_json(client, "/api/v1/auth/login/code", {"email": email})


def verify_login(client, email="ada@example.com", code: str | None = None, device_id=""):
    payload = {"email": email, "code": code or verification_code_from_mailbox()}
    if device_id:
        payload["device_id"] = device_id
    return post_json(client, "/api/v1/auth/login/verify", payload)


def login_with_code(client, email="ada@example.com", device_id=""):
    request_login_code(client, email=email)
    return verify_login(client, email=email, device_id=device_id)


def login(client, email="ada@example.com", password=PASSWORD, device_id=""):
    payload = {"email": email, "password": password}
    if device_id:
        payload["device_id"] = device_id
    return post_json(client, "/api/v1/auth/login", payload)


def bearer(access):
    return {"HTTP_AUTHORIZATION": f"Bearer {access}"}
