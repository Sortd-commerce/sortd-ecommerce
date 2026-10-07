from __future__ import annotations

import logging
from decimal import Decimal

import stripe
from django.conf import settings
from ninja_extra.exceptions import ValidationError

from commerce.models import Order, PaymentStatus

logger = logging.getLogger(__name__)

STRIPE_CHECKOUT_METHODS = frozenset({"card", "apple_pay"})


class StripeNotConfigured(Exception):
    pass


def stripe_enabled() -> bool:
    return bool(getattr(settings, "STRIPE_SECRET_KEY", ""))


def stripe_publishable_key() -> str:
    return getattr(settings, "STRIPE_PUBLISHABLE_KEY", "") or ""


def _client() -> stripe:
    secret = getattr(settings, "STRIPE_SECRET_KEY", "") or ""
    if not secret:
        raise StripeNotConfigured("Card payments are not available right now.")
    stripe.api_key = secret
    return stripe


def _amount_minor(total: Decimal, currency: str) -> int:
    code = currency.upper()
    if code in {"JPY", "KRW"}:
        return int(total)
    return int(total * 100)


def create_checkout_intent(*, total: Decimal, currency: str, user_id: int) -> stripe.PaymentIntent:
    client = _client()
    return client.PaymentIntent.create(
        amount=_amount_minor(total, currency),
        currency=currency.lower(),
        metadata={"user_id": str(user_id)},
        automatic_payment_methods={"enabled": True},
    )


def create_payment_intent(order: Order) -> stripe.PaymentIntent:
    client = _client()
    return client.PaymentIntent.create(
        amount=_amount_minor(order.total, order.currency),
        currency=order.currency.lower(),
        metadata={"order_number": order.number, "order_id": str(order.id)},
        automatic_payment_methods={"enabled": True},
    )


def retrieve_payment_intent(payment_intent_id: str) -> stripe.PaymentIntent:
    client = _client()
    return client.PaymentIntent.retrieve(payment_intent_id)


def verify_webhook(payload: bytes, signature: str | None) -> stripe.Event:
    secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", "") or ""
    if not secret:
        raise StripeNotConfigured("Stripe webhook is not configured.")
    client = _client()
    return client.Webhook.construct_event(payload, signature or "", secret)


def mark_order_paid(order: Order, *, payment_intent_id: str) -> Order:
    if order.payment_status == PaymentStatus.PAID:
        return order
    order.payment_status = PaymentStatus.PAID
    order.stripe_payment_intent_id = payment_intent_id
    order.save(update_fields=["payment_status", "stripe_payment_intent_id"])
    return order


def sync_order_from_intent(order: Order, intent: stripe.PaymentIntent) -> Order:
    if intent.status == "succeeded":
        return mark_order_paid(order, payment_intent_id=intent.id)
    return order


def uses_stripe_payment(code: str) -> bool:
    return code in STRIPE_CHECKOUT_METHODS


def require_stripe_available() -> None:
    if not stripe_enabled():
        raise ValidationError({"payment_method": "Online payments are not available right now."})


def require_paid_intent(*, intent_id: str, user_id: int, total: Decimal, currency: str) -> stripe.PaymentIntent:
    intent = retrieve_payment_intent(intent_id)
    metadata = intent.metadata or {}
    if str(metadata.get("user_id")) != str(user_id):
        raise ValidationError({"payment": "Invalid payment session."})
    if intent.status != "succeeded":
        raise ValidationError({"payment": "Payment has not completed yet."})
    if _amount_minor(total, currency) != intent.amount:
        raise ValidationError({"payment": "Payment amount does not match order total."})
    if Order.objects.filter(stripe_payment_intent_id=intent_id).exists():
        raise ValidationError({"payment": "This payment was already used for an order."})
    return intent
