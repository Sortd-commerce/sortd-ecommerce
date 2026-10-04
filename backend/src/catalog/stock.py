from dataclasses import dataclass

from catalog.models import ProductVariant, StockMovement, StockMovementKind
from ninja_extra.exceptions import ValidationError

from core.messages import ErrorMessage


@dataclass(frozen=True)
class StockChange:
    variant_id: int
    quantity: int


class StockService:
    def decrement_for_sale(self, *, variant: ProductVariant, quantity: int, order_id: int, actor=None) -> ProductVariant:
        if quantity < 1:
            raise ValidationError({"quantity": "Quantity must be at least 1."})
        if variant.on_hand < quantity:
            raise ValidationError({"stock": ErrorMessage.OUT_OF_STOCK})
        variant.on_hand -= quantity
        variant.save(update_fields=["on_hand"])
        StockMovement.objects.create(
            variant=variant,
            kind=StockMovementKind.SALE,
            delta=-quantity,
            on_hand_after=variant.on_hand,
            order_id=order_id,
            actor=actor,
        )
        return variant

    def restore_for_cancellation(self, *, variant: ProductVariant, quantity: int, order_id: int, actor=None) -> ProductVariant:
        variant.on_hand += quantity
        variant.save(update_fields=["on_hand"])
        StockMovement.objects.create(
            variant=variant,
            kind=StockMovementKind.CANCELLATION,
            delta=quantity,
            on_hand_after=variant.on_hand,
            order_id=order_id,
            actor=actor,
        )
        return variant

    def set_on_hand(self, *, variant: ProductVariant, quantity: int, actor=None) -> ProductVariant:
        if quantity < 0:
            raise ValidationError({"on_hand": "Stock cannot be below zero."})
        delta = quantity - variant.on_hand
        if delta == 0:
            return variant
        variant.on_hand = quantity
        variant.save(update_fields=["on_hand"])
        kind = StockMovementKind.RESTOCK if delta > 0 else StockMovementKind.ADJUSTMENT
        StockMovement.objects.create(
            variant=variant,
            kind=kind,
            delta=delta,
            on_hand_after=variant.on_hand,
            actor=actor,
        )
        return variant
