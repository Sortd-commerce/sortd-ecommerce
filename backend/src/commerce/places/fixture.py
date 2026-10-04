from decimal import Decimal

from commerce.places.types import AutocompleteSuggestion, GeocodeResult


class FixtureProvider:
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
        self._by_coords = {
            (item.latitude, item.longitude): item
            for item in self._by_query.values()
            if item.latitude is not None and item.longitude is not None
        }

    def autocomplete(self, *, query: str, country: str = "ae", limit: int = 8) -> list[AutocompleteSuggestion]:
        del country
        needle = query.strip().lower()
        if not needle:
            return []
        suggestions: list[AutocompleteSuggestion] = []
        for key, result in self._by_query.items():
            if needle in key or needle in result.formatted_address.lower():
                suggestions.append(
                    AutocompleteSuggestion(
                        place_id=result.place_id,
                        label=result.formatted_address,
                        latitude=result.latitude,
                        longitude=result.longitude,
                    )
                )
            if len(suggestions) >= limit:
                break
        return suggestions

    def geocode(
        self,
        *,
        address: str | None = None,
        place_id: str | None = None,
        latitude: Decimal | None = None,
        longitude: Decimal | None = None,
    ) -> GeocodeResult:
        if place_id and place_id in self._by_place:
            return self._by_place[place_id]
        if latitude is not None and longitude is not None:
            for (lat, lng), result in self._by_coords.items():
                if abs(lat - latitude) < Decimal("0.01") and abs(lng - longitude) < Decimal("0.01"):
                    return result
        if address:
            key = address.strip().lower()
            if key in self._by_query:
                return self._by_query[key]
            for query_key, result in self._by_query.items():
                if query_key in key or key in result.formatted_address.lower():
                    return result
        return GeocodeResult(status="ZERO_RESULTS")
