from datetime import date
from decimal import Decimal

from ninja import Schema
from pydantic import Field, field_validator


class AddressIn(Schema):
    line1: str = Field(min_length=1, max_length=200)
    line2: str = Field(default="", max_length=200)
    city: str = Field(min_length=1, max_length=120)
    region: str = Field(default="", max_length=120)
    postal_code: str = Field(default="", max_length=20)
    country: str = Field(default="AE", max_length=2)
    place_id: str = Field(default="", max_length=256)
    formatted_address: str = Field(default="", max_length=400)
    is_default: bool = False


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
    is_default: bool


class DeliveryCheckIn(Schema):
    address: str | None = None
    place_id: str | None = None


class CartItemIn(Schema):
    variant_id: int
    quantity: int = Field(ge=0, le=99)


class CartMergeIn(Schema):
    items: list[CartItemIn]


class PlaceOrderIn(Schema):
    address_id: int
    delivery_date: date
    window_id: int
    window_source: str = "weekly"
    note: str = ""
    expected_total: Decimal
    discount_code: str | None = None
    payment_method: str = "cod"

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
