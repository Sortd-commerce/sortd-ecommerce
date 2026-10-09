import re
from datetime import datetime
from typing import Literal

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from ninja import Schema
from pydantic import Field, field_validator

E164 = re.compile(r"^\+[1-9]\d{7,14}$")
CODE_RE = re.compile(r"^\d{6}$")


def split_full_name(value: str) -> tuple[str, str]:
    parts = value.strip().split(None, 1)
    if not parts:
        raise ValueError("This field may not be blank.")
    first = parts[0]
    last = parts[1].strip() if len(parts) > 1 else ""
    return first, last


class SignupIn(Schema):
    email: str = Field(max_length=254)
    full_name: str = Field(min_length=1, max_length=301)
    phone: str = Field(min_length=8, max_length=16)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        email = value.strip().lower()
        try:
            validate_email(email)
        except DjangoValidationError as exc:
            raise ValueError(exc.messages[0]) from exc
        return email

    @field_validator("full_name")
    @classmethod
    def strip_full_name(cls, value: str) -> str:
        name = " ".join(value.split())
        if not name:
            raise ValueError("This field may not be blank.")
        return name

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        phone = value.strip()
        if not E164.match(phone):
            raise ValueError("Enter a phone number in E.164 format.")
        return phone


class VerifyCodeIn(Schema):
    email: str = Field(max_length=254)
    code: str = Field(min_length=6, max_length=6)
    device_id: str = Field(default="", max_length=64)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        code = value.strip()
        if not CODE_RE.match(code):
            raise ValueError("Enter the 6-digit code from your email.")
        return code


class RequestLoginCodeIn(Schema):
    email: str = Field(max_length=254)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class ResendCodeIn(Schema):
    email: str = Field(max_length=254)
    purpose: Literal["signup", "login"] = "signup"

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class LoginIn(Schema):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128)
    device_id: str = Field(default="", max_length=64)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class RefreshIn(Schema):
    refresh: str = Field(min_length=1)


class VerifyIn(Schema):
    token: str = Field(min_length=1)


class VerifyEmailIn(Schema):
    token: str = Field(min_length=1)
    device_id: str = Field(default="", max_length=64)


class ResendVerificationIn(Schema):
    email: str = Field(max_length=254)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class ForgotPasswordIn(Schema):
    email: str = Field(max_length=254)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class ResetPasswordIn(Schema):
    token: str = Field(min_length=1)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise ValueError(" ".join(exc.messages)) from exc
        return value


class ProfileUpdateIn(Schema):
    first_name: str | None = Field(default=None, max_length=150)
    last_name: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=16)

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        phone = value.strip()
        if not E164.match(phone):
            raise ValueError("Enter a phone number in E.164 format.")
        return phone


class PasswordChangeIn(Schema):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, value: str, info) -> str:
        user = (info.context or {}).get("user") if info else None
        try:
            validate_password(value, user=user)
        except DjangoValidationError as exc:
            raise ValueError(" ".join(exc.messages)) from exc
        return value


class UserOut(Schema):
    id: int
    email: str
    first_name: str
    last_name: str
    phone: str
    email_verified_at: datetime | None
    date_joined: datetime


class TokenPairOut(Schema):
    access: str
    refresh: str


class DeviceOut(Schema):
    id: str
    label: str
    is_new: bool


class SessionOut(Schema):
    device_id: str
    label: str
    ip_address: str | None = None
    last_seen_at: datetime
    created_at: datetime
    current: bool = False


class AuthOut(Schema):
    user: UserOut
    tokens: TokenPairOut
    device: DeviceOut | None = None


class SignupOut(Schema):
    user: UserOut


class VerifyOut(Schema):
    valid: bool


class PasswordChangedOut(Schema):
    password_changed: bool


class LoggedOutOut(Schema):
    logged_out: bool


class ResentOut(Schema):
    sent: bool
    purpose: Literal["login", "signup"] | None = None
