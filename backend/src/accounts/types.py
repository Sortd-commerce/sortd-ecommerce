from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True)
class SignupCommand:
    email: str
    password: str
    first_name: str
    last_name: str
    phone: str


@dataclass(frozen=True)
class LoginCommand:
    email: str
    password: str
    device_id: str = ""


@dataclass(frozen=True)
class DeviceSnapshot:
    id: str
    label: str
    is_new: bool


@dataclass(frozen=True)
class ProfileUpdateCommand:
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None


@dataclass(frozen=True)
class UserSnapshot:
    id: int
    email: str
    first_name: str
    last_name: str
    phone: str
    email_verified_at: datetime | None
    date_joined: datetime


@dataclass(frozen=True)
class TokenPair:
    access: str
    refresh: str


@dataclass(frozen=True)
class AuthResult:
    user: UserSnapshot
    tokens: TokenPair
    device: DeviceSnapshot | None = None


class EmailSender(Protocol):
    def send_verification(self, *, to: str, link: str, first_name: str = "") -> None: ...

    def send_password_reset(self, *, to: str, link: str, first_name: str = "") -> None: ...

    def send_order_confirmation(self, *, to: str, order: dict, first_name: str = "") -> None: ...

    def send_order_cancellation(self, *, to: str, order: dict, first_name: str = "") -> None: ...

    def send_new_device_login(
        self, *, to: str, first_name: str = "", label: str = "", ip_address: str | None = None
    ) -> None: ...


class TokenIssuer(Protocol):
    def issue(self, user, session_id: int | None = None) -> TokenPair: ...
