from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any


@dataclass(frozen=True)
class AutocompleteSuggestion:
    place_id: str
    label: str
    latitude: Decimal | None = None
    longitude: Decimal | None = None


@dataclass(frozen=True)
class GeocodeResult:
    status: str
    formatted_address: str = ""
    postal_code: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    place_id: str = ""
    address_components: list[dict[str, Any]] = field(default_factory=list)
