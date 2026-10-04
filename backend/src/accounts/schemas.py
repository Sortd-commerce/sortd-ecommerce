import re
from datetime import datetime

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from ninja import Schema
from pydantic import Field, field_validator

E164 = re.compile(r"^\+[1-9]\d{7,14}$")


class SignupIn(Schema):
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=150)
    last_name: str = Field(min_length=1, max_length=150)
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

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise ValueError(" ".join(exc.messages)) from exc
        return value

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        name = value.strip()
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


class LoginIn(Schema):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128)

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


class AuthOut(Schema):
    user: UserOut
    tokens: TokenPairOut


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
