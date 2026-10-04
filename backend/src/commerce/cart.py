from dataclasses import dataclass

from django.db import transaction
from ninja_extra.exceptions import NotFound, ValidationError

from catalog.models import ProductStatus, ProductVariant
from commerce.models import Cart, CartItem
from core.messages import ErrorMessage
from core.money import money, money_str, ZERO


MAX_QUANTITY = 99


@dataclass(frozen=True)
class CartLineCommand:
    variant_id: int
    quantity: int


class CartService:
    def get_or_create(self, user) -> Cart:
        cart, _ = Cart.objects.get_or_create(user=user)
        return cart

    def view(self, user) -> dict:
        cart = self.get_or_create(user)
        items = list(cart.items.select_related("variant", "variant__product").all())
        lines = []
        subtotal = ZERO
        for item in items:
            variant = item.variant
            available = (
                variant.is_active
                and variant.product.status == ProductStatus.ACTIVE
                and variant.on_hand >= item.quantity
            )
            line_total = money(variant.price) * item.quantity
            if available:
                subtotal += line_total
            lines.append(
                {
                    "id": item.id,
                    "variant_id": variant.id,
                    "title": variant.product.title,
                    "sku": variant.sku,
                    "quantity": item.quantity,
                    "unit_price": money_str(variant.price),
                    "line_total": money_str(line_total),
                    "available": available,
                    "on_hand": variant.on_hand,
                }
            )
        return {"items": lines, "subtotal": money_str(subtotal), "currency": "AED"}

    def merge(self, user, lines: list[CartLineCommand]) -> dict:
        cart = self.get_or_create(user)
        with transaction.atomic():
            for line in lines:
                self._upsert(cart, line.variant_id, line.quantity, add=True)
        return self.view(user)

    def replace(self, user, lines: list[CartLineCommand]) -> dict:
        cart = self.get_or_create(user)
        wanted = {line.variant_id: line.quantity for line in lines if line.quantity > 0}
        with transaction.atomic():
            CartItem.objects.filter(cart=cart).exclude(variant_id__in=wanted.keys()).delete()
            for variant_id, quantity in wanted.items():
                self._upsert(cart, variant_id, quantity, add=False)
        return self.view(user)

    def set_item(self, user, *, variant_id: int, quantity: int) -> dict:
        cart = self.get_or_create(user)
        with transaction.atomic():
            if quantity == 0:
                CartItem.objects.filter(cart=cart, variant_id=variant_id).delete()
            else:
                self._upsert(cart, variant_id, quantity, add=False)
        return self.view(user)

    def remove_item(self, user, *, item_id: int) -> dict:
        cart = self.get_or_create(user)
        deleted, _ = CartItem.objects.filter(cart=cart, id=item_id).delete()
        if not deleted:
            raise NotFound(ErrorMessage.NOT_FOUND)
        return self.view(user)

    def _upsert(self, cart: Cart, variant_id: int, quantity: int, *, add: bool) -> None:
        if quantity < 1 or quantity > MAX_QUANTITY:
            raise ValidationError({"quantity": "Quantity must be between 1 and 99."})
        variant = ProductVariant.objects.filter(
            pk=variant_id, is_active=True, product__status=ProductStatus.ACTIVE
        ).first()
        if variant is None:
            raise ValidationError({"variant_id": "That product is not available."})
        item = CartItem.objects.filter(cart=cart, variant=variant).first()
        if item is None:
            CartItem.objects.create(cart=cart, variant=variant, quantity=quantity)
            return
        item.quantity = min(item.quantity + quantity, MAX_QUANTITY) if add else quantity
        if item.quantity < 1:
            item.delete()
        else:
            item.save(update_fields=["quantity"])
