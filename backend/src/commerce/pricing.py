from dataclasses import dataclass
from decimal import Decimal

from catalog.models import ProductVariant
from commerce.discounts import amount_for, select_discount
from commerce.models import CommerceSettings, Discount
from core.money import ZERO, money, money_str


@dataclass(frozen=True)
class PriceQuote:
    subtotal: Decimal
    discount_amount: Decimal
    discount_code: str
    delivery_fee: Decimal
    configured_delivery_fee: Decimal
    free_delivery_minimum: Decimal
    amount_until_free_delivery: Decimal
    total: Decimal

    def as_dict(self) -> dict:
        return {
            "subtotal": money_str(self.subtotal),
            "discount_amount": money_str(self.discount_amount),
            "discount_code": self.discount_code,
            "delivery_fee": money_str(self.delivery_fee),
            "configured_delivery_fee": money_str(self.configured_delivery_fee),
            "free_delivery_minimum": money_str(self.free_delivery_minimum),
            "amount_until_free_delivery": money_str(self.amount_until_free_delivery),
            "total": money_str(self.total),
        }


def quote_variants(items: list[tuple[int, int]], *, code: str | None = None, now=None) -> PriceQuote:
    wanted = {variant_id: quantity for variant_id, quantity in items if quantity > 0}
    variants = ProductVariant.objects.select_related("product").filter(pk__in=wanted)
    lines = []
    for variant in variants:
        quantity = wanted[variant.id]
        line_total = money(variant.price) * quantity
        lines.append((variant, quantity, line_total))
    return quote_lines(lines, code=code, now=now)


def quote_lines(lines: list[tuple[ProductVariant, int, Decimal]], *, code: str | None = None, now=None) -> PriceQuote:
    settings_row = CommerceSettings.load()
    configured_fee = money(settings_row.delivery_fee)
    minimum = money(settings_row.free_delivery_minimum)
    subtotal = money(sum((line_total for _, _, line_total in lines), ZERO))
    discount_code = ""
    if code and code.strip():
        discount = select_discount(code=code, now=now)
        discount_amount = amount_for(discount=discount, lines=lines)
        discount_code = (discount.code or "") if discount else ""
    else:
        discount_amount = _automatic_savings(lines, now)
    if discount_amount > subtotal:
        discount_amount = subtotal
    discount_amount = money(discount_amount)
    merchandise = money(subtotal - discount_amount)
    delivery_fee, remaining = _delivery_charge(merchandise, configured_fee, minimum)
    return PriceQuote(
        subtotal=subtotal,
        discount_amount=discount_amount,
        discount_code=discount_code,
        delivery_fee=delivery_fee,
        configured_delivery_fee=configured_fee,
        free_delivery_minimum=minimum,
        amount_until_free_delivery=remaining,
        total=money(merchandise + delivery_fee),
    )


def serialize_offer_rules() -> dict:
    settings_row = CommerceSettings.load()
    discounts = [
        _serialize_discount(row)
        for row in Discount.objects.filter(is_active=True, code__isnull=True).select_related("product")
        if _currently_open(row)
    ]
    return {
        "delivery_fee": money_str(settings_row.delivery_fee),
        "free_delivery_minimum": money_str(settings_row.free_delivery_minimum),
        "discounts": discounts,
    }


def _delivery_charge(merchandise: Decimal, configured_fee: Decimal, minimum: Decimal) -> tuple[Decimal, Decimal]:
    if configured_fee <= ZERO or minimum <= ZERO or merchandise >= minimum:
        return ZERO, ZERO
    return configured_fee, money(minimum - merchandise)


def _automatic_savings(lines, now) -> Decimal:
    discounts = [
        row
        for row in Discount.objects.filter(is_active=True, code__isnull=True).select_related("product", "variant")
        if _currently_open(row, now)
    ]
    savings = ZERO
    general = []
    for variant, quantity, line_total in lines:
        offers = [row for row in discounts if row.scope != Discount.Scope.ALL and _applies(row, variant)]
        if offers:
            savings += max(amount_for(discount=row, lines=[(variant, quantity, line_total)]) for row in offers)
        else:
            general.append((variant, quantity, line_total))
    globals_ = [row for row in discounts if row.scope == Discount.Scope.ALL]
    if globals_ and general:
        savings += max(amount_for(discount=row, lines=general) for row in globals_)
    return money(savings)


def _currently_open(discount: Discount, now=None) -> bool:
    from django.utils import timezone

    moment = now or timezone.now()
    if discount.starts_at and moment < discount.starts_at:
        return False
    if discount.ends_at and moment > discount.ends_at:
        return False
    return True


def _applies(discount: Discount, variant: ProductVariant) -> bool:
    if discount.scope == Discount.Scope.VARIANT:
        return variant.id == discount.variant_id
    if discount.scope == Discount.Scope.PRODUCT:
        return variant.product_id == discount.product_id
    if discount.scope == Discount.Scope.CATEGORY:
        return variant.product.category_id == discount.category_id
    return False


def _serialize_discount(row: Discount) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "kind": row.kind,
        "value": money_str(row.value),
        "scope": row.scope,
        "product_id": row.product_id,
        "product_title": row.product.title if row.product_id else "",
        "is_active": row.is_active,
    }
