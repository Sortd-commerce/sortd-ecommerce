from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Protocol
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json

from django.conf import settings

from config.environment import LOCAL, PRODUCTION


@dataclass(frozen=True)
class GeocodeResult:
    status: str
    formatted_address: str = ""
    postal_code: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    place_id: str = ""
    address_components: list[dict[str, Any]] = field(default_factory=list)


class Geocoder(Protocol):
    def geocode(self, *, address: str | None = None, place_id: str | None = None) -> GeocodeResult: ...


class ClosedGeocoder:
    def geocode(self, *, address: str | None = None, place_id: str | None = None) -> GeocodeResult:
        return GeocodeResult(status="ZERO_RESULTS")


class FixtureGeocoder:
    def __init__(self) -> None:
        self._by_query = {
            "dubai marina": GeocodeResult(
                status="OK",
                formatted_address="Dubai Marina, Dubai, United Arab Emirates",
                postal_code="00000",
                latitude=Decimal("25.080500"),
                longitude=Decimal("55.140300"),
                place_id="fixture-dubai-marina",
                address_components=[
                    {"long_name": "00000", "short_name": "00000", "types": ["postal_code"]},
                    {"long_name": "Dubai", "short_name": "Dubai", "types": ["locality"]},
                ],
            ),
            "outside": GeocodeResult(
                status="OK",
                formatted_address="Abu Dhabi, United Arab Emirates",
                postal_code="99999",
                latitude=Decimal("24.453900"),
                longitude=Decimal("54.377300"),
                place_id="fixture-abu-dhabi",
                address_components=[
                    {"long_name": "99999", "short_name": "99999", "types": ["postal_code"]},
                ],
            ),
        }
        self._by_place = {item.place_id: item for item in self._by_query.values()}

    def geocode(self, *, address: str | None = None, place_id: str | None = None) -> GeocodeResult:
        if place_id and place_id in self._by_place:
            return self._by_place[place_id]
        if address:
            key = address.strip().lower()
            if key in self._by_query:
                return self._by_query[key]
        return GeocodeResult(status="ZERO_RESULTS")


class GoogleGeocoder:
    def geocode(self, *, address: str | None = None, place_id: str | None = None) -> GeocodeResult:
        params: dict[str, str] = {"key": settings.GOOGLE_MAPS_API_KEY}
        if place_id:
            params["place_id"] = place_id
        elif address:
            params["address"] = address
        else:
            return GeocodeResult(status="ZERO_RESULTS")
        url = f"{settings.GOOGLE_GEOCODE_URL}?{urlencode(params)}"
        request = Request(url, headers={"User-Agent": "sortd-backend"})
        try:
            with urlopen(request, timeout=5) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except Exception:
            return GeocodeResult(status="ZERO_RESULTS")
        status = payload.get("status") or "ZERO_RESULTS"
        results = payload.get("results") or []
        if status != "OK" or not results:
            return GeocodeResult(status="ZERO_RESULTS")
        first = results[0]
        components = first.get("address_components") or []
        postal = None
        for component in components:
            if "postal_code" in (component.get("types") or []):
                postal = component.get("long_name")
                break
        location = (first.get("geometry") or {}).get("location") or {}
        lat = location.get("lat")
        lng = location.get("lng")
        return GeocodeResult(
            status="OK",
            formatted_address=first.get("formatted_address") or "",
            postal_code=postal,
            latitude=Decimal(str(lat)) if lat is not None else None,
            longitude=Decimal(str(lng)) if lng is not None else None,
            place_id=first.get("place_id") or "",
            address_components=components,
        )


def build_geocoder() -> Geocoder:
    if settings.GOOGLE_MAPS_API_KEY:
        return GoogleGeocoder()
    if settings.ENVIRONMENT == LOCAL:
        return FixtureGeocoder()
    return ClosedGeocoder()
