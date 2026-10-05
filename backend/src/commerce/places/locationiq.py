from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import urlencode

from django.conf import settings

from commerce.places.http import get_json
from commerce.places.types import AutocompleteSuggestion, GeocodeResult

_OSM_PREFIX = {"node": "N", "way": "W", "relation": "R"}


def _to_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _osm_place_id(item: dict[str, Any]) -> str:
    osm_type = str(item.get("osm_type") or "").lower()
    osm_id = item.get("osm_id")
    prefix = _OSM_PREFIX.get(osm_type)
    if prefix and osm_id is not None:
        return f"{prefix}{osm_id}"
    place_id = item.get("place_id")
    return str(place_id) if place_id is not None else ""


def _postal_from_address(address: dict[str, Any] | None) -> str | None:
    if not address:
        return None
    for key in ("postcode", "postal_code"):
        value = address.get(key)
        if value:
            return str(value)
    return None


def _components_from_address(address: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not address:
        return []
    mapping = (
        ("postcode", "postal_code"),
        ("city", "locality"),
        ("town", "locality"),
        ("suburb", "sublocality"),
        ("state", "administrative_area_level_1"),
        ("country", "country"),
        ("road", "route"),
        ("house_number", "street_number"),
    )
    components: list[dict[str, Any]] = []
    for source, type_name in mapping:
        value = address.get(source)
        if value:
            components.append(
                {"long_name": str(value), "short_name": str(value), "types": [type_name]}
            )
    return components


def _result_from_item(item: dict[str, Any]) -> GeocodeResult:
    address = item.get("address") if isinstance(item.get("address"), dict) else None
    lat = _to_decimal(item.get("lat"))
    lon = _to_decimal(item.get("lon"))
    return GeocodeResult(
        status="OK",
        formatted_address=str(item.get("display_name") or ""),
        postal_code=_postal_from_address(address),
        latitude=lat,
        longitude=lon,
        place_id=_osm_place_id(item),
        address_components=_components_from_address(address),
    )


class LocationIQProvider:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        autocomplete_url: str | None = None,
        search_url: str | None = None,
        reverse_url: str | None = None,
        lookup_url: str | None = None,
    ) -> None:
        self._api_key = api_key or settings.LOCATIONIQ_API_KEY
        self._autocomplete_url = autocomplete_url or settings.LOCATIONIQ_AUTOCOMPLETE_URL
        self._search_url = search_url or settings.LOCATIONIQ_SEARCH_URL
        self._reverse_url = reverse_url or settings.LOCATIONIQ_REVERSE_URL
        self._lookup_url = lookup_url or settings.LOCATIONIQ_LOOKUP_URL

    def autocomplete(self, *, query: str, country: str = "ae", limit: int = 8) -> list[AutocompleteSuggestion]:
        needle = query.strip()
        if not needle or not self._api_key:
            return []
        params = {
            "key": self._api_key,
            "q": needle,
            "limit": str(max(1, min(limit, 10))),
            "normalizecity": "1",
            "addressdetails": "1",
        }
        if country.strip():
            params["countrycodes"] = country.strip().lower()
        payload = get_json(f"{self._autocomplete_url}?{urlencode(params)}")
        if not isinstance(payload, list):
            return []
        suggestions: list[AutocompleteSuggestion] = []
        for item in payload:
            if not isinstance(item, dict):
                continue
            place_id = _osm_place_id(item)
            label = str(item.get("display_name") or "").strip()
            if not place_id or not label:
                continue
            suggestions.append(
                AutocompleteSuggestion(
                    place_id=place_id,
                    label=label,
                    latitude=_to_decimal(item.get("lat")),
                    longitude=_to_decimal(item.get("lon")),
                )
            )
        return suggestions

    def geocode(
        self,
        *,
        address: str | None = None,
        place_id: str | None = None,
        latitude: Decimal | None = None,
        longitude: Decimal | None = None,
    ) -> GeocodeResult:
        if place_id:
            looked_up = self._lookup(place_id.strip())
            if looked_up.status == "OK":
                return looked_up
        if latitude is not None and longitude is not None:
            return self._reverse(latitude=latitude, longitude=longitude)
        if address and address.strip():
            return self._search(address.strip())
        return GeocodeResult(status="ZERO_RESULTS")

    def _lookup(self, place_id: str) -> GeocodeResult:
        osm_ids = place_id.upper()
        if not osm_ids or osm_ids[0] not in {"N", "W", "R"}:
            return GeocodeResult(status="ZERO_RESULTS")
        params = {"key": self._api_key, "osm_ids": osm_ids, "format": "json", "addressdetails": "1"}
        payload = get_json(f"{self._lookup_url}?{urlencode(params)}")
        items = payload if isinstance(payload, list) else []
        if not items or not isinstance(items[0], dict):
            return GeocodeResult(status="ZERO_RESULTS")
        return _result_from_item(items[0])

    def _reverse(self, *, latitude: Decimal, longitude: Decimal) -> GeocodeResult:
        params = {
            "key": self._api_key,
            "lat": str(latitude),
            "lon": str(longitude),
            "format": "json",
            "addressdetails": "1",
        }
        payload = get_json(f"{self._reverse_url}?{urlencode(params)}")
        if not isinstance(payload, dict) or payload.get("error"):
            return GeocodeResult(status="ZERO_RESULTS")
        return _result_from_item(payload)

    def _search(self, address: str) -> GeocodeResult:
        params = {
            "key": self._api_key,
            "q": address,
            "format": "json",
            "limit": "1",
            "addressdetails": "1",
            "countrycodes": "ae",
        }
        payload = get_json(f"{self._search_url}?{urlencode(params)}")
        if not isinstance(payload, list) or not payload or not isinstance(payload[0], dict):
            return GeocodeResult(status="ZERO_RESULTS")
        return _result_from_item(payload[0])
