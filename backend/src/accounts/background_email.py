"""Send mail off the HTTP request thread so provider latency does not block API responses."""

from __future__ import annotations

import logging
import threading
from collections.abc import Callable
from typing import Any

from django.conf import settings
from django.db import close_old_connections

from accounts.emailing import DjangoEmailSender, EmailSendError

logger = logging.getLogger(__name__)


def _run_in_background(task: Callable[[], None], *, description: str) -> None:
    def worker() -> None:
        close_old_connections()
        try:
            task()
        except EmailSendError:
            logger.exception("%s failed (email delivery)", description)
        except Exception:
            logger.exception("%s failed (unexpected)", description)
        finally:
            close_old_connections()

    threading.Thread(target=worker, daemon=True, name="sortd-mail").start()


class BackgroundEmailSender:
    def __init__(self, delegate: DjangoEmailSender | None = None) -> None:
        self._delegate = delegate or DjangoEmailSender()

    def _defer(self, method: str, **kwargs: Any) -> None:
        fn = getattr(self._delegate, method)
        recipient = kwargs.get("to", "?")
        _run_in_background(lambda: fn(**kwargs), description=f"{method} to={recipient}")

    def send_verification(self, *, to: str, link: str, first_name: str = "") -> None:
        self._defer("send_verification", to=to, link=link, first_name=first_name)

    def send_auth_code(self, *, to: str, code: str, first_name: str = "", purpose: str = "signup") -> None:
        self._defer("send_auth_code", to=to, code=code, first_name=first_name, purpose=purpose)

    def send_password_reset(self, *, to: str, link: str, first_name: str = "") -> None:
        self._defer("send_password_reset", to=to, link=link, first_name=first_name)

    def send_order_confirmation(self, *, to: str, order: dict, first_name: str = "") -> None:
        self._defer("send_order_confirmation", to=to, order=order, first_name=first_name)

    def send_order_cancellation(self, *, to: str, order: dict, first_name: str = "") -> None:
        self._defer("send_order_cancellation", to=to, order=order, first_name=first_name)

    def send_new_device_login(
        self, *, to: str, first_name: str = "", label: str = "", ip_address: str | None = None
    ) -> None:
        self._defer(
            "send_new_device_login",
            to=to,
            first_name=first_name,
            label=label,
            ip_address=ip_address,
        )


def should_send_email_in_background() -> bool:
    if not getattr(settings, "EMAIL_SEND_IN_BACKGROUND", True):
        return False
    backend = settings.MAILERS.get("default", {}).get("BACKEND", "")
    return "locmem" not in backend


def build_email_sender() -> DjangoEmailSender | BackgroundEmailSender:
    delegate = DjangoEmailSender()
    if should_send_email_in_background():
        return BackgroundEmailSender(delegate)
    return delegate
