from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db.models import Count
from ninja_extra.exceptions import ValidationError

from commerce.geocoding import GeocodeResult, PlacesProvider
from commerce.places.types import AutocompleteSuggestion
from commerce.delivery_zones import find_zone_for_coordinates
from commerce.models import DeliveryDateOverride, DeliveryWindow, Order, OrderStatus
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
    status: str


DUBAI_LOCATION_TYPES = (
    "locality",
    "administrative_area_level_1",
    "administrative_area_level_2",
    "sublocality",
    "sublocality_level_1",
)

OTHER_UAE_EMIRATES = (
    "abu dhabi",
    "sharjah",
    "ajman",
    "fujairah",
    "ras al khaimah",
    "umm al quwain",
    "al ain",
)

DUBAI_BBOX = {
    "min_lat": Decimal("24.79"),
    "max_lat": Decimal("25.36"),
    "min_lon": Decimal("54.98"),
    "max_lon": Decimal("55.64"),
}


def _component_text(components: list[dict], type_name: str) -> str:
    for component in components:
        if type_name in (component.get("types") or []):
            value = component.get("long_name") or component.get("short_name") or ""
            if value:
                return str(value)
    return ""


def _is_uae(components: list[dict]) -> bool:
    for component in components:
        if "country" not in (component.get("types") or []):
            continue
        short_name = str(component.get("short_name") or "").upper()
        long_name = str(component.get("long_name") or "").lower()
        if short_name == "AE" or "united arab emirates" in long_name:
            return True
    return False


def _is_in_dubai_bbox(*, latitude: Decimal | None, longitude: Decimal | None) -> bool:
    if latitude is None or longitude is None:
        return False
    return (
        DUBAI_BBOX["min_lat"] <= latitude <= DUBAI_BBOX["max_lat"]
        and DUBAI_BBOX["min_lon"] <= longitude <= DUBAI_BBOX["max_lon"]
    )


def _is_dubai_suggestion(item: AutocompleteSuggestion) -> bool:
    label = (item.label or "").lower()
    if any(name in label for name in OTHER_UAE_EMIRATES):
        return False
    if "dubai" in label:
        return True
    return _is_in_dubai_bbox(latitude=item.latitude, longitude=item.longitude)


def _is_dubai_location(result: GeocodeResult) -> bool:
    if result.status != "OK":
        return False

    components = result.address_components or []
    if components and not _is_uae(components):
        return False

    parts = [result.formatted_address or ""]
    parts.extend(_component_text(components, type_name) for type_name in DUBAI_LOCATION_TYPES)
    haystack = " ".join(part for part in parts if part).lower()
    return "dubai" in haystack


class DeliveryService:
    def __init__(self, *, clock, geocoder: PlacesProvider) -> None:
        self._clock = clock
        self._geocoder = geocoder
        self._zone = ZoneInfo(settings.DELIVERY_TIMEZONE)

    def autocomplete(self, *, query: str, country: str = "", limit: int = 8) -> list[dict]:
        batch_size = max(limit * 3, limit)
        suggestions = self._geocoder.autocomplete(query=query, country=country or "ae", limit=batch_size)
        dubai_suggestions = [item for item in suggestions if _is_dubai_suggestion(item)]
        return [
            {
                "place_id": item.place_id,
                "label": item.label,
                "latitude": str(item.latitude) if item.latitude is not None else None,
                "longitude": str(item.longitude) if item.longitude is not None else None,
            }
            for item in dubai_suggestions[:limit]
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
        zone = self.find_zone(result)
        serviceable = zone is not None
        return {
            "status": result.status,
            "formatted_address": result.formatted_address,
            "postal_code": result.postal_code,
            "place_id": result.place_id,
            "latitude": str(result.latitude) if result.latitude is not None else None,
            "longitude": str(result.longitude) if result.longitude is not None else None,
            "address_components": result.address_components,
            "serviceable": serviceable,
            "zone_id": zone.id if zone else None,
            "zone_name": zone.name if zone else None,
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

    def find_zone(self, result: GeocodeResult):
        if result.status != "OK":
            return None
        if not _is_dubai_location(result):
            return None
        return find_zone_for_coordinates(latitude=result.latitude, longitude=result.longitude)

    def is_serviceable(self, result: GeocodeResult) -> bool:
        return self.find_zone(result) is not None

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
        if not matching or matching[0].status != "available" or matching[0].remaining < 1:
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
            remaining = max(capacity - used.get((start, end), 0), 0)
            if now >= cutoff_at:
                status = "passed"
            elif remaining < 1:
                status = "full"
            else:
                status = "available"
            slots.append(
                SlotView(
                    date=day,
                    start_time=start,
                    end_time=end,
                    capacity=capacity,
                    remaining=remaining,
                    window_id=window_id,
                    source=source,
                    status=status,
                )
            )
        return slots
