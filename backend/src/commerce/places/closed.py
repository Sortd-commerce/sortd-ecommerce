from decimal import Decimal

from commerce.places.types import AutocompleteSuggestion, GeocodeResult


class ClosedProvider:
    def autocomplete(self, *, query: str, country: str = "ae", limit: int = 8) -> list[AutocompleteSuggestion]:
        del query, country, limit
        return []

    def geocode(
        self,
        *,
        address: str | None = None,
        place_id: str | None = None,
        latitude: Decimal | None = None,
        longitude: Decimal | None = None,
    ) -> GeocodeResult:
        del address, place_id, latitude, longitude
        return GeocodeResult(status="ZERO_RESULTS")
