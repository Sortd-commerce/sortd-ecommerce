"""Clock collaborator so time-based rules can be tested without sleeping."""

from datetime import datetime
from typing import Protocol

from django.utils import timezone


class Clock(Protocol):
    def now(self) -> datetime: ...


class SystemClock:
    def now(self) -> datetime:
        return timezone.now()
