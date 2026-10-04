from decimal import ROUND_HALF_UP, Decimal

TWOPLACES = Decimal("0.01")
ZERO = Decimal("0.00")


def money(value: Decimal | int | str) -> Decimal:
    return Decimal(value).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def money_str(value: Decimal | int | str) -> str:
    return format(money(value), "f")
