from decimal import Decimal

from django.utils import timezone
from ninja_extra.exceptions import ValidationError

from catalog.models import ProductVariant
from commerce.models import Discount
from core.money import ZERO, money


def discount_error() -> None:
    raise ValidationError({"code": "That discount code is not valid."})


def select_discount(*, code: str | None, now=None) -> Discount | None:
    moment = now or timezone.now()
    if code:
        discount = Discount.objects.filter(code__iexact=code.strip(), is_active=True).first()
        if discount is None or not _in_window(discount, moment):
            discount_error()
        return discount
    candidates = [
        row
        for row in Discount.objects.filter(code__isnull=True, is_active=True)
        if _in_window(row, moment)
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda row: row.value)


def amount_for(*, discount: Discount | None, lines: list[tuple[ProductVariant, int, Decimal]]) -> Decimal:
    if discount is None:
        return ZERO
    eligible = ZERO
    for variant, quantity, line_total in lines:
        if _applies(discount, variant):
            eligible += line_total
    if eligible <= ZERO:
        return ZERO
    if discount.kind == Discount.Kind.PERCENT:
        percent = min(discount.value, Decimal("100"))
        return money(eligible * percent / Decimal("100"))
    return min(money(discount.value), eligible)


def _in_window(discount: Discount, moment) -> bool:
    if discount.starts_at and moment < discount.starts_at:
        return False
    if discount.ends_at and moment > discount.ends_at:
        return False
    return True


def _applies(discount: Discount, variant: ProductVariant) -> bool:
    if discount.scope == Discount.Scope.ALL:
        return True
    if discount.scope == Discount.Scope.VARIANT:
        return variant.id == discount.variant_id
    if discount.scope == Discount.Scope.PRODUCT:
        return variant.product_id == discount.product_id
    if discount.scope == Discount.Scope.CATEGORY:
        return variant.product.category_id == discount.category_id
    return False
