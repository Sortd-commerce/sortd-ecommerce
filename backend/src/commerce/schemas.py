from datetime import date
from decimal import Decimal

from ninja import Schema
from pydantic import Field, field_validator, model_validator

from commerce.models import AddressLabel


class AddressIn(Schema):
    line1: str = Field(default="", max_length=200)
    line2: str = Field(default="", max_length=200)
    city: str = Field(default="", max_length=120)
    region: str = Field(default="", max_length=120)
    postal_code: str = Field(default="", max_length=20)
    country: str = Field(default="AE", max_length=2)
    place_id: str = Field(default="", max_length=256)
    formatted_address: str = Field(default="", max_length=400)
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    is_default: bool = False
    label: str = Field(default=AddressLabel.OTHER, max_length=16)
    community: str = Field(default="", max_length=120)
    building: str = Field(default="", max_length=120)
    unit: str = Field(default="", max_length=80)
    floor: str = Field(default="", max_length=40)

    @field_validator("label")
    @classmethod
    def normalize_label(cls, value: str) -> str:
        label = (value or AddressLabel.OTHER).strip().lower()
        allowed = {choice.value for choice in AddressLabel}
        if label not in allowed:
            raise ValueError("label must be home, work, or other.")
        return label

    @model_validator(mode="after")
    def require_location_hint(self):
        has_text = bool(self.line1.strip() or self.formatted_address.strip())
        has_place = bool(self.place_id.strip())
        has_coords = self.latitude is not None and self.longitude is not None
        if not (has_text or has_place or has_coords):
            raise ValueError("Provide place_id, coordinates, or an address.")
        return self


class AddressOut(Schema):
    id: int
    line1: str
    line2: str
    city: str
    region: str
    postal_code: str
    country: str
    place_id: str
    formatted_address: str
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    is_default: bool
    label: str
    community: str
    building: str
    unit: str
    floor: str


class DeliveryCheckIn(Schema):
    address: str | None = None
    place_id: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None

    @model_validator(mode="after")
    def require_one_locator(self):
        has_address = bool((self.address or "").strip())
        has_place = bool((self.place_id or "").strip())
        has_coords = self.latitude is not None and self.longitude is not None
        if not (has_address or has_place or has_coords):
            raise ValueError("Provide place_id, latitude/longitude, or address.")
        if (self.latitude is None) ^ (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together.")
        return self


class AutocompleteIn(Schema):
    q: str = Field(min_length=1, max_length=200)
    country: str = Field(default="", max_length=8)
    limit: int = Field(default=8, ge=1, le=10)


class CartItemIn(Schema):
    variant_id: int
    quantity: int = Field(ge=0, le=99)


class CartMergeIn(Schema):
    items: list[CartItemIn]


class CartSyncIn(Schema):
    items: list[CartItemIn]


class PriceQuoteIn(Schema):
    items: list[CartItemIn] = []
    discount_code: str | None = None


class StripeIntentIn(Schema):
    expected_total: Decimal
    discount_code: str | None = None


class CheckoutValidateIn(Schema):
    address_id: int
    delivery_date: date
    window_id: int
    window_source: str = "weekly"
    expected_total: Decimal | None = None
    discount_code: str | None = None
    payment_method: str = "cod"

    @field_validator("payment_method")
    @classmethod
    def normalize_payment_method(cls, value: str) -> str:
        code = value.strip().lower()
        if not code:
            raise ValueError("Select a payment method.")
        return code

    @field_validator("window_source")
    @classmethod
    def validate_source(cls, value: str) -> str:
        if value not in {"weekly", "override"}:
            raise ValueError("window_source must be weekly or override.")
        return value


class StripeCheckoutSessionIn(CheckoutValidateIn):
    note: str = ""
    expected_total: Decimal

    @field_validator("note")
    @classmethod
    def strip_note(cls, value: str) -> str:
        return value.strip()[:500]


class StripeCheckoutCompleteIn(Schema):
    session_id: str

    @field_validator("session_id")
    @classmethod
    def strip_session(cls, value: str) -> str:
        code = value.strip()
        if not code:
            raise ValueError("Missing payment session.")
        return code


class PlaceOrderIn(Schema):
    address_id: int
    delivery_date: date
    window_id: int
    window_source: str = "weekly"
    note: str = ""
    expected_total: Decimal
    discount_code: str | None = None
    payment_method: str = "cod"
    stripe_payment_intent_id: str | None = None

    @field_validator("payment_method")
    @classmethod
    def normalize_payment_method(cls, value: str) -> str:
        code = value.strip().lower()
        if not code:
            raise ValueError("Select a payment method.")
        return code

    @field_validator("window_source")
    @classmethod
    def validate_source(cls, value: str) -> str:
        if value not in {"weekly", "override"}:
            raise ValueError("window_source must be weekly or override.")
        return value

    @field_validator("note")
    @classmethod
    def strip_note(cls, value: str) -> str:
        return value.strip()
