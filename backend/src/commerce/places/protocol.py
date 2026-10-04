from decimal import Decimal
from typing import Protocol

from commerce.places.types import AutocompleteSuggestion, GeocodeResult


class PlacesProvider(Protocol):
    def autocomplete(
        self, *, query: str, country: str = "ae", limit: int = 8
    ) -> list[AutocompleteSuggestion]: ...

    def geocode(
        self,
        *,
        address: str | None = None,
        place_id: str | None = None,
        latitude: Decimal | None = None,
        longitude: Decimal | None = None,
    ) -> GeocodeResult: ...
