from dataclasses import dataclass
from decimal import Decimal

from catalog.models import ProductStatus, ProductVariant
from commerce.discounts import amount_for, coupon_eligible, require_coupon_eligible, select_discount
from commerce.models import CommerceSettings, Discount
from core.messages import ErrorMessage
from core.money import ZERO, money, money_str
from ninja_extra.exceptions import ValidationError


@dataclass(frozen=True)
class PriceQuote:
    subtotal: Decimal
    discount_amount: Decimal
    discount_code: str
    discount_name: str
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
            "discount_name": self.discount_name,
            "delivery_fee": money_str(self.delivery_fee),
            "configured_delivery_fee": money_str(self.configured_delivery_fee),
            "free_delivery_minimum": money_str(self.free_delivery_minimum),
            "amount_until_free_delivery": money_str(self.amount_until_free_delivery),
            "total": money_str(self.total),
        }


def quote_variants(
    items: list[tuple[int, int]],
    *,
    code: str | None = None,
    user=None,
    now=None,
) -> PriceQuote:
    wanted = {variant_id: quantity for variant_id, quantity in items if quantity > 0}
    if not wanted:
        raise ValidationError({"items": "Your cart is empty."})
    variants = list(ProductVariant.objects.select_related("product").filter(pk__in=wanted))
    if len(variants) != len(wanted):
        raise ValidationError({"stock": ErrorMessage.OUT_OF_STOCK})
    lines = []
    for variant in variants:
        quantity = wanted[variant.id]
        if (
            not variant.is_active
            or variant.product.status != ProductStatus.ACTIVE
            or variant.on_hand < quantity
        ):
            raise ValidationError({"stock": ErrorMessage.OUT_OF_STOCK})
        line_total = money(variant.price) * quantity
        lines.append((variant, quantity, line_total))
    return quote_lines(lines, code=code, user=user, now=now)


def quote_lines(
    lines: list[tuple[ProductVariant, int, Decimal]],
    *,
    code: str | None = None,
    user=None,
    now=None,
) -> PriceQuote:
    settings_row = CommerceSettings.load()
    configured_fee = money(settings_row.delivery_fee)
    minimum = money(settings_row.free_delivery_minimum)
    subtotal = money(sum((line_total for _, _, line_total in lines), ZERO))
    discount_code = ""
    discount_name = ""
    free_delivery_coupon = False
    if code and code.strip():
        discount = select_discount(code=code, now=now)
        require_coupon_eligible(discount=discount, subtotal=subtotal, user=user)
        discount_code = discount.code or ""
        discount_name = discount.headline or discount.name
        if discount.benefit == Discount.Benefit.FREE_DELIVERY:
            free_delivery_coupon = True
            discount_amount = ZERO
        else:
            discount_amount = amount_for(discount=discount, lines=lines)
    else:
        discount_amount = _automatic_savings(lines, now)
    if discount_amount > subtotal:
        discount_amount = subtotal
    discount_amount = money(discount_amount)
    merchandise = money(subtotal - discount_amount)
    if free_delivery_coupon:
        delivery_fee = ZERO
        remaining = ZERO
    else:
        delivery_fee, remaining = _delivery_charge(merchandise, configured_fee, minimum)
    return PriceQuote(
        subtotal=subtotal,
        discount_amount=discount_amount,
        discount_code=discount_code,
        discount_name=discount_name,
        delivery_fee=delivery_fee,
        configured_delivery_fee=configured_fee,
        free_delivery_minimum=minimum,
        amount_until_free_delivery=remaining,
        total=money(merchandise + delivery_fee),
    )


def preview_coupons(
    lines: list[tuple[ProductVariant, int, Decimal]],
    *,
    user=None,
    now=None,
) -> list[dict]:
    subtotal = money(sum((line_total for _, _, line_total in lines), ZERO))
    settings_row = CommerceSettings.load()
    configured_fee = money(settings_row.delivery_fee)
    rows = [
        row
        for row in Discount.objects.filter(is_active=True).exclude(code__isnull=True).exclude(code="")
        if _currently_open(row, now)
    ]
    previews = []
    for row in rows:
        eligible, amount_needed, ineligible_reason = coupon_eligible(discount=row, subtotal=subtotal, user=user)
        if ineligible_reason == "first_order_used":
            continue
        if row.benefit == Discount.Benefit.FREE_DELIVERY:
            estimated_savings = configured_fee if eligible else ZERO
        else:
            estimated_savings = amount_for(discount=row, lines=lines) if eligible else ZERO
        previews.append(
            {
                **_serialize_coupon(row, amount_needed=amount_needed),
                "eligible": eligible,
                "ineligible_reason": ineligible_reason or "",
                "amount_needed": money_str(amount_needed),
                "estimated_savings": money_str(estimated_savings),
            }
        )
    best_code = ""
    best_savings = ZERO
    for item in previews:
        if not item["eligible"]:
            continue
        savings = money(item["estimated_savings"])
        if savings > best_savings:
            best_savings = savings
            best_code = item["code"]
    for item in previews:
        item["is_best"] = item["code"] == best_code and best_code != ""
    return previews


def serialize_offer_rules() -> dict:
    settings_row = CommerceSettings.load()
    discounts = [
        _serialize_discount(row)
        for row in Discount.objects.filter(is_active=True, code__isnull=True).select_related("product")
        if _currently_open(row)
    ]
    coupons = [
        _serialize_coupon(row)
        for row in Discount.objects.filter(is_active=True).exclude(code__isnull=True).exclude(code="")
        if _currently_open(row)
    ]
    return {
        "delivery_fee": money_str(settings_row.delivery_fee),
        "free_delivery_minimum": money_str(settings_row.free_delivery_minimum),
        "discounts": discounts,
        "coupons": coupons,
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


def _serialize_coupon(row: Discount, *, amount_needed: Decimal | None = None) -> dict:
    return {
        "code": row.code or "",
        "name": row.name,
        "headline": row.headline or row.name,
        "detail": _coupon_detail(row, amount_needed=amount_needed),
        "kind": row.kind,
        "benefit": row.benefit,
        "value": money_str(row.value),
        "scope": row.scope,
        "minimum_order": money_str(row.minimum_order) if row.minimum_order else "",
        "max_discount": money_str(row.max_discount) if row.max_discount else "",
        "first_order_only": row.first_order_only,
    }


def _coupon_detail(row: Discount, *, amount_needed: Decimal | None = None) -> str:
    if row.detail:
        if amount_needed and amount_needed > ZERO and "add aed" not in row.detail.lower():
            return f"{row.detail} · add AED {money_str(amount_needed)} more"
        return row.detail
    parts = []
    if row.benefit == Discount.Benefit.FREE_DELIVERY:
        parts.append("Free delivery")
    elif row.kind == Discount.Kind.PERCENT:
        parts.append(f"{money_str(row.value).rstrip('0').rstrip('.')}% off")
    else:
        parts.append(f"AED {money_str(row.value)} off")
    if row.max_discount:
        parts.append(f"up to AED {money_str(row.max_discount)}")
    if row.minimum_order:
        parts.append(f"on orders over AED {money_str(row.minimum_order)}")
    if amount_needed and amount_needed > ZERO:
        parts.append(f"add AED {money_str(amount_needed)} more")
    if row.first_order_only:
        parts.append("first order only")
    return " · ".join(parts)
