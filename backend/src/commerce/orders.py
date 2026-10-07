from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from hashlib import sha256
import json

from django.conf import settings
from django.db import IntegrityError, transaction
from ninja_extra.exceptions import NotFound, ValidationError

import logging

from catalog.models import ProductStatus, ProductVariant
from catalog.stock import StockService
from commerce.cart import CartService, MAX_QUANTITY
from commerce.delivery import DeliveryService
from commerce.pricing import quote_lines
from commerce.geocoding import GeocodeResult
from commerce.models import (
    Address,
    DeliveryOverrideWindow,
    DeliveryWindow,
    Order,
    OrderLine,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
)
from commerce.stripe_payments import (
    require_paid_intent,
    require_stripe_available,
    uses_stripe_payment,
)
from core.exceptions import Conflict
from core.messages import ErrorMessage
from core.money import money, money_str

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PlaceOrderCommand:
    address_id: int
    delivery_date: date
    window_id: int
    window_source: str
    note: str
    expected_total: Decimal
    discount_code: str | None
    payment_method: str = "cod"
    stripe_payment_intent_id: str | None = None


class OrderService:
    def __init__(self, *, clock, delivery: DeliveryService, stock: StockService, cart: CartService, email_sender=None) -> None:
        self._clock = clock
        self._delivery = delivery
        self._stock = stock
        self._cart = cart
        self._email_sender = email_sender

    def place(self, user, command: PlaceOrderCommand, *, idempotency_key: str, request_hash: str) -> Order:
        if not user.is_active or user.email_verified_at is None:
            raise ValidationError({"user": ErrorMessage.EMAIL_NOT_VERIFIED})
        if not idempotency_key:
            raise ValidationError({"idempotency_key": "Idempotency-Key is required."})
        existing = Order.objects.filter(user=user, idempotency_key=idempotency_key).first()
        if existing is not None:
            if existing.request_hash != request_hash:
                raise Conflict("The request could not be completed because of a conflict.")
            return existing

        address = Address.objects.filter(user=user, pk=command.address_id).first()
        if address is None:
            raise NotFound(ErrorMessage.NOT_FOUND)
        geo = self._delivery.check_address(
            address=address.formatted_address or None,
            place_id=address.place_id or None,
            latitude=address.latitude,
            longitude=address.longitude,
        )
        result = GeocodeResult(
            status=geo["status"],
            formatted_address=geo["formatted_address"],
            postal_code=geo["postal_code"],
            latitude=Decimal(geo["latitude"]) if geo["latitude"] else None,
            longitude=Decimal(geo["longitude"]) if geo["longitude"] else None,
            place_id=geo["place_id"],
            address_components=geo["address_components"],
        )
        self._delivery.require_serviceable(result)

        payment = PaymentMethod.objects.filter(code=command.payment_method, is_active=True).first()
        if payment is None:
            raise ValidationError({"payment_method": "That payment method is not available."})
        if uses_stripe_payment(payment.code):
            require_stripe_available()

        cart = self._cart.get_or_create(user)
        items = list(cart.items.select_related("variant", "variant__product").all())
        if not items:
            raise ValidationError({"cart": "Your cart is empty."})

        quantities: dict[int, int] = {}
        for item in items:
            if item.quantity < 1 or item.quantity > MAX_QUANTITY:
                raise ValidationError({"quantity": "Quantity must be between 1 and 99."})
            quantities[item.variant_id] = quantities.get(item.variant_id, 0) + item.quantity

        try:
            with transaction.atomic():
                slot = self._lock_slot(command)
                variants = list(
                    ProductVariant.objects.select_for_update()
                    .select_related("product")
                    .filter(pk__in=quantities)
                    .order_by("pk")
                )
                if len(variants) != len(quantities):
                    raise ValidationError({"stock": ErrorMessage.OUT_OF_STOCK})
                priced = []
                for variant in variants:
                    qty = quantities[variant.id]
                    if (
                        not variant.is_active
                        or variant.product.status != ProductStatus.ACTIVE
                        or variant.on_hand < qty
                    ):
                        raise ValidationError({"stock": ErrorMessage.OUT_OF_STOCK})
                    line_total = money(variant.price) * qty
                    priced.append((variant, qty, line_total))

                priced_quote = quote_lines(priced, code=command.discount_code, user=user, now=self._clock.now())
                if money(command.expected_total) != priced_quote.total:
                    raise Conflict(ErrorMessage.TOTAL_MISMATCH)

                stripe_intent_id = ""
                if uses_stripe_payment(payment.code):
                    intent_id = (command.stripe_payment_intent_id or "").strip()
                    if not intent_id:
                        raise ValidationError({"payment": "Complete payment before placing your order."})
                    paid_intent = require_paid_intent(
                        intent_id=intent_id,
                        user_id=user.id,
                        total=priced_quote.total,
                        currency=settings.DEFAULT_CURRENCY,
                    )
                    stripe_intent_id = paid_intent.id
                    payment_status = PaymentStatus.PAID
                else:
                    payment_status = PaymentStatus.UNPAID

                order = Order.objects.create(
                    user=user,
                    number=self._next_number(),
                    status=OrderStatus.PLACED,
                    payment_method=payment.code,
                    payment_status=payment_status,
                    stripe_payment_intent_id=stripe_intent_id,
                    currency=settings.DEFAULT_CURRENCY,
                    subtotal=priced_quote.subtotal,
                    discount_amount=priced_quote.discount_amount,
                    discount_code=priced_quote.discount_code,
                    delivery_fee=priced_quote.delivery_fee,
                    total=priced_quote.total,
                    note=command.note.strip(),
                    delivery_date=command.delivery_date,
                    delivery_start=slot.start_time,
                    delivery_end=slot.end_time,
                    window_id=slot.window_id,
                    address_line1=address.line1,
                    address_line2=address.line2,
                    address_city=address.city,
                    address_region=address.region,
                    address_postal_code=result.postal_code or address.postal_code,
                    address_country=address.country,
                    address_formatted=result.formatted_address or address.formatted_address,
                    address_place_id=result.place_id or address.place_id,
                    latitude=result.latitude,
                    longitude=result.longitude,
                    idempotency_key=idempotency_key,
                    request_hash=request_hash,
                )
                for variant, qty, line_total in priced:
                    OrderLine.objects.create(
                        order=order,
                        variant=variant,
                        title=variant.product.title,
                        sku=variant.sku,
                        unit_price=money(variant.price),
                        quantity=qty,
                        line_total=line_total,
                    )
                    self._stock.decrement_for_sale(variant=variant, quantity=qty, order_id=order.id, actor=user)
                cart.items.all().delete()
        except IntegrityError:
            existing = Order.objects.filter(user=user, idempotency_key=idempotency_key).first()
            if existing and existing.request_hash == request_hash:
                return existing
            raise Conflict("The request could not be completed because of a conflict.") from None

        self._notify_placed(user, order)
        return order

    def list_for(self, user):
        return Order.objects.filter(user=user).prefetch_related("lines")

    def get_for(self, user, *, number: str) -> Order:
        order = Order.objects.filter(user=user, number=number).prefetch_related("lines").first()
        if order is None:
            raise NotFound(ErrorMessage.NOT_FOUND)
        return order

    def cancel(self, user, *, number: str) -> Order:
        order = self.get_for(user, number=number)
        with transaction.atomic():
            updated = Order.objects.filter(
                pk=order.pk, user=user, status__in=[OrderStatus.PLACED, OrderStatus.CONFIRMED]
            ).update(status=OrderStatus.CANCELLED)
            if not updated:
                raise ValidationError({"status": ErrorMessage.CANNOT_CANCEL})
            order.refresh_from_db()
            for line in order.lines.select_related("variant"):
                if line.variant_id:
                    variant = ProductVariant.objects.select_for_update().get(pk=line.variant_id)
                    self._stock.restore_for_cancellation(
                        variant=variant, quantity=line.quantity, order_id=order.id, actor=user
                    )
        self._notify_cancelled(user, order)
        return order

    def _lock_slot(self, command: PlaceOrderCommand):
        slot = self._delivery.require_open_slot(
            delivery_date=command.delivery_date,
            window_id=command.window_id,
            source=command.window_source,
        )
        if command.window_source == "weekly":
            DeliveryWindow.objects.select_for_update().get(pk=command.window_id)
        else:
            DeliveryOverrideWindow.objects.select_for_update().get(pk=command.window_id)
        taken = (
            Order.objects.filter(
                delivery_date=command.delivery_date,
                delivery_start=slot.start_time,
                delivery_end=slot.end_time,
            )
            .exclude(status=OrderStatus.CANCELLED)
            .count()
        )
        if taken >= slot.capacity:
            raise ValidationError({"window": ErrorMessage.SLOT_UNAVAILABLE})
        return slot

    def _next_number(self) -> str:
        today = self._clock.now().date()
        prefix = today.strftime("SRT-%Y%m%d-")
        count = Order.objects.filter(number__startswith=prefix).count() + 1
        return f"{prefix}{count:04d}"

    def _notify_placed(self, user, order: Order) -> None:
        if self._email_sender is None:
            return
        try:
            order = Order.objects.prefetch_related("lines").get(pk=order.pk)
            self._email_sender.send_order_confirmation(
                to=user.email,
                order=serialize_order(order),
                first_name=user.first_name,
            )
        except Exception:
            logger.exception("Order confirmation email failed for %s", order.number)

    def _notify_cancelled(self, user, order: Order) -> None:
        if self._email_sender is None:
            return
        try:
            order = Order.objects.prefetch_related("lines").get(pk=order.pk)
            self._email_sender.send_order_cancellation(
                to=user.email,
                order=serialize_order(order),
                first_name=user.first_name,
            )
        except Exception:
            logger.exception("Order cancellation email failed for %s", order.number)


def request_hash_for(payload: dict) -> str:
    encoded = json.dumps(payload, sort_keys=True, default=str)
    return sha256(encoded.encode("utf-8")).hexdigest()


def serialize_order(order: Order, *, client_secret: str | None = None) -> dict:
    payload = {
        "id": order.id,
        "number": order.number,
        "status": order.status,
        "payment_method": order.payment_method,
        "payment_status": order.payment_status,
        "currency": order.currency,
        "subtotal": money_str(order.subtotal),
        "discount_amount": money_str(order.discount_amount),
        "discount_code": order.discount_code,
        "delivery_fee": money_str(order.delivery_fee),
        "total": money_str(order.total),
        "note": order.note,
        "delivery_date": order.delivery_date.isoformat(),
        "delivery_start": order.delivery_start.isoformat(),
        "delivery_end": order.delivery_end.isoformat(),
        "address": {
            "line1": order.address_line1,
            "line2": order.address_line2,
            "city": order.address_city,
            "region": order.address_region,
            "postal_code": order.address_postal_code,
            "country": order.address_country,
            "formatted_address": order.address_formatted,
        },
        "lines": [
            {
                "title": line.title,
                "sku": line.sku,
                "quantity": line.quantity,
                "unit_price": money_str(line.unit_price),
                "line_total": money_str(line.line_total),
            }
            for line in order.lines.all()
        ],
        "created_at": order.created_at.isoformat(),
    }
    if client_secret:
        payload["client_secret"] = client_secret
    return payload
