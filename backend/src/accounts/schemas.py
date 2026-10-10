import re
from datetime import datetime
from typing import Literal

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from ninja import Schema
from pydantic import Field, field_validator

CODE_RE = re.compile(r"^\d{6}$")

DUBAI_COUNTRY_CODE = "971"
# Dubai uses standard UAE mobile numbering: +971 5X XXX XXXX (9 digits after country code).
DUBAI_MOBILE_E164 = re.compile(rf"^\+{DUBAI_COUNTRY_CODE}5[024568]\d{{7}}$")
DUBAI_MOBILE_MESSAGE = (
    "Enter a Dubai mobile number: 9 digits starting with 50, 52, 54, 55, 56, or 58 "
    "(for example, 50 123 4567). Without +971."
)
DUBAI_MOBILE_TOO_LONG = (
    "Phone number is too long. Enter 9 Dubai mobile digits without +971 (for example, 50 123 4567)."
)


def normalize_dubai_mobile(value: str) -> str:
    phone = value.strip()
    if phone.startswith("00"):
        phone = f"+{phone[2:]}"
    elif phone.startswith("+"):
        pass
    elif phone:
        digits = re.sub(r"\D", "", phone)
        if digits.startswith("0"):
            digits = digits[1:]
        if digits.startswith(DUBAI_COUNTRY_CODE):
            digits = digits[len(DUBAI_COUNTRY_CODE) :]
        phone = f"+{DUBAI_COUNTRY_CODE}{digits}"
    if phone.startswith(f"+{DUBAI_COUNTRY_CODE}"):
        rest = phone[4:]
        while rest.startswith("0"):
            rest = rest[1:]
        if rest.startswith(DUBAI_COUNTRY_CODE):
            rest = rest[len(DUBAI_COUNTRY_CODE) :]
        phone = f"+{DUBAI_COUNTRY_CODE}{rest}"
    return phone


def assert_dubai_mobile(phone: str) -> str:
    normalized = phone.strip()
    if not normalized.startswith(f"+{DUBAI_COUNTRY_CODE}"):
        raise ValueError(DUBAI_MOBILE_MESSAGE)
    local = re.sub(r"\D", "", normalized[4:])
    if len(local) > 9:
        raise ValueError(DUBAI_MOBILE_TOO_LONG)
    if not DUBAI_MOBILE_E164.match(normalized):
        raise ValueError(DUBAI_MOBILE_MESSAGE)
    return normalized


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
    phone: str = Field(min_length=13, max_length=13)

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
            raise ValueError("Enter your full name.")
        if len(name) > 301:
            raise ValueError("Name is too long (use 301 characters or fewer).")
        return name

    @field_validator("phone", mode="before")
    @classmethod
    def coerce_phone(cls, value: str) -> str:
        return normalize_dubai_mobile(str(value or ""))

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        return assert_dubai_mobile(value)


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


class SiteAccessIn(Schema):
    password: str = Field(min_length=1, max_length=1024)


class SiteAccessOut(Schema):
    token: str


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
    phone: str | None = Field(default=None, min_length=13, max_length=13)

    @field_validator("phone", mode="before")
    @classmethod
    def coerce_phone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_dubai_mobile(str(value))

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return assert_dubai_mobile(value)


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
