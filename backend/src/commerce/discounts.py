from decimal import Decimal

from django.utils import timezone
from ninja_extra.exceptions import ValidationError

from catalog.models import ProductVariant
from commerce.models import Discount, Order, OrderStatus
from core.money import ZERO, money, money_str


def discount_error() -> None:
    raise ValidationError({"discount_code": "That discount code is not valid."})


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


def require_coupon_eligible(*, discount: Discount, subtotal: Decimal, user=None) -> None:
    minimum = money(discount.minimum_order) if discount.minimum_order else ZERO
    if minimum > ZERO and subtotal < minimum:
        gap = money(minimum - subtotal)
        raise ValidationError({"discount_code": f"Add AED {money_str(gap)} more to use this code."})
    if discount.first_order_only:
        if user is None:
            raise ValidationError({"discount_code": "Sign in to use this code."})
        if Order.objects.filter(user=user).exclude(status=OrderStatus.CANCELLED).exists():
            raise ValidationError({"discount_code": "This code is for first orders only."})


def coupon_eligible(*, discount: Discount, subtotal: Decimal, user=None) -> tuple[bool, Decimal]:
    minimum = money(discount.minimum_order) if discount.minimum_order else ZERO
    if minimum > ZERO and subtotal < minimum:
        return False, money(minimum - subtotal)
    if discount.first_order_only:
        if user is None:
            return False, ZERO
        if Order.objects.filter(user=user).exclude(status=OrderStatus.CANCELLED).exists():
            return False, ZERO
    return True, ZERO


def amount_for(*, discount: Discount | None, lines: list[tuple[ProductVariant, int, Decimal]]) -> Decimal:
    if discount is None:
        return ZERO
    if discount.benefit == Discount.Benefit.FREE_DELIVERY:
        return ZERO
    eligible = ZERO
    for variant, quantity, line_total in lines:
        if _applies(discount, variant):
            eligible += line_total
    if eligible <= ZERO:
        return ZERO
    if discount.kind == Discount.Kind.PERCENT:
        percent = min(discount.value, Decimal("100"))
        amount = money(eligible * percent / Decimal("100"))
    else:
        amount = min(money(discount.value), eligible)
    if discount.max_discount:
        amount = min(amount, money(discount.max_discount))
    return amount


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
