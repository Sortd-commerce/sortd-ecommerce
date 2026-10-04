from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db.models import Count
from ninja_extra.exceptions import ValidationError

from commerce.geocoding import GeocodeResult, PlacesProvider
from commerce.models import (
    DeliveryDateOverride,
    DeliveryPostalCode,
    DeliveryWindow,
    Order,
    OrderStatus,
    normalize_postal_code,
)
from core.messages import ErrorMessage


@dataclass(frozen=True)
class SlotView:
    date: date
    start_time: time
    end_time: time
    capacity: int
    remaining: int
    window_id: int
    source: str


class DeliveryService:
    def __init__(self, *, clock, geocoder: PlacesProvider) -> None:
        self._clock = clock
        self._geocoder = geocoder
        self._zone = ZoneInfo(settings.DELIVERY_TIMEZONE)

    def autocomplete(self, *, query: str, country: str = "ae", limit: int = 8) -> list[dict]:
        suggestions = self._geocoder.autocomplete(query=query, country=country, limit=limit)
        return [
            {
                "place_id": item.place_id,
                "label": item.label,
                "latitude": str(item.latitude) if item.latitude is not None else None,
                "longitude": str(item.longitude) if item.longitude is not None else None,
            }
            for item in suggestions
        ]

    def check_address(
        self,
        *,
        address: str | None = None,
        place_id: str | None = None,
        latitude: Decimal | None = None,
        longitude: Decimal | None = None,
    ) -> dict:
        result = self._resolve(address=address, place_id=place_id, latitude=latitude, longitude=longitude)
        serviceable = self.is_serviceable(result)
        return {
            "status": result.status,
            "formatted_address": result.formatted_address,
            "postal_code": result.postal_code,
            "place_id": result.place_id,
            "latitude": str(result.latitude) if result.latitude is not None else None,
            "longitude": str(result.longitude) if result.longitude is not None else None,
            "address_components": result.address_components,
            "serviceable": serviceable,
        }

    def resolve_address(
        self,
        *,
        address: str | None = None,
        place_id: str | None = None,
        latitude: Decimal | None = None,
        longitude: Decimal | None = None,
    ) -> GeocodeResult:
        return self._resolve(address=address, place_id=place_id, latitude=latitude, longitude=longitude)

    def _resolve(
        self,
        *,
        address: str | None = None,
        place_id: str | None = None,
        latitude: Decimal | None = None,
        longitude: Decimal | None = None,
    ) -> GeocodeResult:
        # Preference: place_id → lat/lng → address text.
        if place_id:
            result = self._geocoder.geocode(place_id=place_id)
            if result.status == "OK":
                return result
        if latitude is not None and longitude is not None:
            result = self._geocoder.geocode(latitude=latitude, longitude=longitude)
            if result.status == "OK":
                return result
        if address:
            return self._geocoder.geocode(address=address)
        return GeocodeResult(status="ZERO_RESULTS")

    def is_serviceable(self, result: GeocodeResult) -> bool:
        if result.status != "OK" or not result.postal_code:
            return False
        code = normalize_postal_code(result.postal_code)
        if not code:
            return False
        return DeliveryPostalCode.objects.filter(code=code, is_active=True).exists()

    def require_serviceable(self, result: GeocodeResult) -> None:
        if not self.is_serviceable(result):
            raise ValidationError({"address": ErrorMessage.NOT_SERVICEABLE})

    def list_windows(self, *, days: int = 7) -> list[SlotView]:
        now = self._clock.now().astimezone(self._zone)
        today = now.date()
        slots: list[SlotView] = []
        for offset in range(days):
            day = today + timedelta(days=offset)
            slots.extend(self._slots_for(day, now=now))
        return slots

    def require_open_slot(self, *, delivery_date: date, window_id: int, source: str) -> SlotView:
        now = self._clock.now().astimezone(self._zone)
        matching = [
            slot
            for slot in self._slots_for(delivery_date, now=now)
            if slot.window_id == window_id and slot.source == source
        ]
        if not matching or matching[0].remaining < 1:
            raise ValidationError({"window": ErrorMessage.SLOT_UNAVAILABLE})
        return matching[0]

    def _slots_for(self, day: date, *, now: datetime) -> list[SlotView]:
        override = DeliveryDateOverride.objects.filter(date=day).first()
        if override and override.kind == DeliveryDateOverride.Kind.CLOSED:
            return []
        if override and override.kind == DeliveryDateOverride.Kind.REPLACE:
            templates = [
                (window.pk, window.start_time, window.end_time, window.capacity, window.cutoff_minutes, "override")
                for window in override.windows.all()
            ]
        else:
            templates = [
                (window.pk, window.start_time, window.end_time, window.capacity, window.cutoff_minutes, "weekly")
                for window in DeliveryWindow.objects.filter(weekday=day.weekday(), is_active=True)
            ]
        used = {
            (row["delivery_start"], row["delivery_end"]): row["c"]
            for row in Order.objects.filter(delivery_date=day)
            .exclude(status=OrderStatus.CANCELLED)
            .values("delivery_start", "delivery_end")
            .annotate(c=Count("id"))
        }
        slots = []
        for window_id, start, end, capacity, cutoff, source in templates:
            cutoff_at = datetime.combine(day, start, tzinfo=self._zone) - timedelta(minutes=cutoff)
            if now >= cutoff_at:
                continue
            remaining = max(capacity - used.get((start, end), 0), 0)
            slots.append(
                SlotView(
                    date=day,
                    start_time=start,
                    end_time=end,
                    capacity=capacity,
                    remaining=remaining,
                    window_id=window_id,
                    source=source,
                )
            )
        return slots
