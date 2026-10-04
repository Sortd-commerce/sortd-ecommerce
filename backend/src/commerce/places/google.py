from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import urlencode

from django.conf import settings

from commerce.places.http import get_json
from commerce.places.types import AutocompleteSuggestion, GeocodeResult


def _to_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _postal_from_components(components: list[dict[str, Any]]) -> str | None:
    for component in components:
        if "postal_code" in (component.get("types") or []):
            value = component.get("long_name")
            return str(value) if value else None
    return None


def _result_from_geocode_payload(payload: dict[str, Any]) -> GeocodeResult:
    status = payload.get("status") or "ZERO_RESULTS"
    results = payload.get("results") or []
    if status != "OK" or not results:
        return GeocodeResult(status="ZERO_RESULTS")
    first = results[0]
    components = first.get("address_components") or []
    location = (first.get("geometry") or {}).get("location") or {}
    return GeocodeResult(
        status="OK",
        formatted_address=first.get("formatted_address") or "",
        postal_code=_postal_from_components(components),
        latitude=_to_decimal(location.get("lat")),
        longitude=_to_decimal(location.get("lng")),
        place_id=first.get("place_id") or "",
        address_components=components,
    )


class GoogleProvider:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        geocode_url: str | None = None,
        autocomplete_url: str | None = None,
    ) -> None:
        self._api_key = api_key or settings.GOOGLE_MAPS_API_KEY
        self._geocode_url = geocode_url or settings.GOOGLE_GEOCODE_URL
        self._autocomplete_url = autocomplete_url or settings.GOOGLE_PLACES_AUTOCOMPLETE_URL

    def autocomplete(self, *, query: str, country: str = "ae", limit: int = 8) -> list[AutocompleteSuggestion]:
        needle = query.strip()
        if not needle or not self._api_key:
            return []
        params = {
            "input": needle,
            "key": self._api_key,
            "components": f"country:{country.lower()}",
            "language": "en",
        }
        payload = get_json(f"{self._autocomplete_url}?{urlencode(params)}")
        if not isinstance(payload, dict) or payload.get("status") not in {"OK", "ZERO_RESULTS"}:
            return []
        suggestions: list[AutocompleteSuggestion] = []
        for prediction in (payload.get("predictions") or [])[:limit]:
            if not isinstance(prediction, dict):
                continue
            place_id = str(prediction.get("place_id") or "").strip()
            label = str(prediction.get("description") or "").strip()
            if place_id and label:
                suggestions.append(AutocompleteSuggestion(place_id=place_id, label=label))
        return suggestions

    def geocode(
        self,
        *,
        address: str | None = None,
        place_id: str | None = None,
        latitude: Decimal | None = None,
        longitude: Decimal | None = None,
    ) -> GeocodeResult:
        params: dict[str, str] = {"key": self._api_key}
        if place_id:
            params["place_id"] = place_id
        elif latitude is not None and longitude is not None:
            params["latlng"] = f"{latitude},{longitude}"
        elif address:
            params["address"] = address
        else:
            return GeocodeResult(status="ZERO_RESULTS")
        payload = get_json(f"{self._geocode_url}?{urlencode(params)}")
        if not isinstance(payload, dict):
            return GeocodeResult(status="ZERO_RESULTS")
        return _result_from_geocode_payload(payload)
