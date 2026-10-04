from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from accounts.tests.helpers import ApiTestCase, bearer, post_json, signup_and_verify
from catalog.tests.test_catalog import make_product
from commerce.models import (
    Address,
    DeliveryPostalCode,
    DeliveryWindow,
    Discount,
    Order,
    OrderStatus,
    PaymentMethod,
)
from core.messages import ErrorMessage


class CheckoutTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        verified = signup_and_verify(self.client)
        self.auth = bearer(verified.json()["data"]["tokens"]["access"])
        from django.contrib.auth import get_user_model

        self.user = get_user_model().objects.get(email="ada@example.com")
        self.product, self.variant = make_product(on_hand=5)
        PaymentMethod.objects.get_or_create(code="cod", defaults={"name": "Cash on delivery", "is_active": True})
        DeliveryPostalCode.objects.create(code="00000")
        now = timezone.now()
        self.tomorrow = (now + timedelta(days=1)).date()
        self.window = DeliveryWindow.objects.create(
            weekday=self.tomorrow.weekday(),
            start_time="09:00:00",
            end_time="12:00:00",
            capacity=2,
            cutoff_minutes=0,
            is_active=True,
        )
        self.address = Address.objects.create(
            user=self.user,
            line1="Marina Walk",
            city="Dubai",
            formatted_address="dubai marina",
            place_id="fixture-dubai-marina",
            postal_code="ignored",
        )

    def _add_to_cart(self, quantity=1):
        return post_json(
            self.client,
            "/api/v1/cart/items",
            {"items": [{"variant_id": self.variant.id, "quantity": quantity}]},
            **self.auth,
        )

    def _order_payload(self, total="16.90", **extra):
        payload = {
            "address_id": self.address.id,
            "delivery_date": self.tomorrow.isoformat(),
            "window_id": self.window.id,
            "window_source": "weekly",
            "note": "Leave at reception",
            "expected_total": total,
            "payment_method": "cod",
        }
        payload.update(extra)
        return payload

    def test_delivery_check_uses_geocoder_postal_code(self):
        response = post_json(self.client, "/api/v1/delivery/check", {"address": "dubai marina"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["data"]["serviceable"])
        self.assertEqual(response.json()["data"]["postal_code"], "00000")

        blocked = post_json(self.client, "/api/v1/delivery/check", {"address": "outside"})
        self.assertFalse(blocked.json()["data"]["serviceable"])

    def test_cart_prices_from_the_live_variant(self):
        added = self._add_to_cart(2)
        self.assertEqual(added.status_code, 200)
        self.assertEqual(added.json()["data"]["subtotal"], "33.80")

    def test_checkout_decrements_stock_and_snapshots_the_order(self):
        self._add_to_cart(2)
        response = post_json(
            self.client,
            "/api/v1/orders",
            self._order_payload(total="33.80"),
            HTTP_IDEMPOTENCY_KEY="key-1",
            **self.auth,
        )
        self.assertEqual(response.status_code, 201)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.on_hand, 3)
        self.assertEqual(response.json()["data"]["total"], "33.80")
        self.assertEqual(response.json()["data"]["note"], "Leave at reception")

    def test_idempotency_replay_does_not_decrement_again(self):
        self._add_to_cart(1)
        first = post_json(
            self.client, "/api/v1/orders", self._order_payload(), HTTP_IDEMPOTENCY_KEY="same", **self.auth
        )
        self.assertEqual(first.status_code, 201)
        self._add_to_cart(1)
        second = post_json(
            self.client, "/api/v1/orders", self._order_payload(), HTTP_IDEMPOTENCY_KEY="same", **self.auth
        )
        self.assertEqual(second.status_code, 201)
        self.assertEqual(first.json()["data"]["number"], second.json()["data"]["number"])
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.on_hand, 4)

    def test_idempotency_conflict_on_a_different_body(self):
        self._add_to_cart(1)
        post_json(self.client, "/api/v1/orders", self._order_payload(), HTTP_IDEMPOTENCY_KEY="same", **self.auth)
        other = post_json(
            self.client,
            "/api/v1/orders",
            self._order_payload(note="Changed"),
            HTTP_IDEMPOTENCY_KEY="same",
            **self.auth,
        )
        self.assertEqual(other.status_code, 409)

    def test_total_mismatch_places_nothing(self):
        self._add_to_cart(1)
        response = post_json(
            self.client, "/api/v1/orders", self._order_payload(total="1.00"), HTTP_IDEMPOTENCY_KEY="k2", **self.auth
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["message"], ErrorMessage.TOTAL_MISMATCH)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.on_hand, 5)
        self.assertFalse(Order.objects.exists())

    def test_out_of_zone_address_is_rejected(self):
        self.address.formatted_address = "outside"
        self.address.place_id = "fixture-abu-dhabi"
        self.address.save()
        self._add_to_cart(1)
        response = post_json(
            self.client, "/api/v1/orders", self._order_payload(), HTTP_IDEMPOTENCY_KEY="k3", **self.auth
        )
        self.assertEqual(response.status_code, 400)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.on_hand, 5)

    def test_cancel_restores_stock_once(self):
        self._add_to_cart(1)
        placed = post_json(
            self.client, "/api/v1/orders", self._order_payload(), HTTP_IDEMPOTENCY_KEY="k4", **self.auth
        )
        number = placed.json()["data"]["number"]
        cancelled = post_json(self.client, f"/api/v1/orders/{number}/cancel", {}, **self.auth)
        self.assertEqual(cancelled.status_code, 200)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.on_hand, 5)
        again = post_json(self.client, f"/api/v1/orders/{number}/cancel", {}, **self.auth)
        self.assertEqual(again.status_code, 400)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.on_hand, 5)

    def test_another_user_cannot_read_an_order(self):
        self._add_to_cart(1)
        placed = post_json(
            self.client, "/api/v1/orders", self._order_payload(), HTTP_IDEMPOTENCY_KEY="k5", **self.auth
        )
        number = placed.json()["data"]["number"]
        other = signup_and_verify(self.client, email="other@example.com")
        other_auth = bearer(other.json()["data"]["tokens"]["access"])
        response = self.client.get(f"/api/v1/orders/{number}", **other_auth)
        self.assertEqual(response.status_code, 404)

    def test_window_capacity_is_enforced(self):
        self.window.capacity = 1
        self.window.save()
        self._add_to_cart(1)
        first = post_json(
            self.client, "/api/v1/orders", self._order_payload(), HTTP_IDEMPOTENCY_KEY="cap-1", **self.auth
        )
        self.assertEqual(first.status_code, 201)
        self._add_to_cart(1)
        second = post_json(
            self.client, "/api/v1/orders", self._order_payload(), HTTP_IDEMPOTENCY_KEY="cap-2", **self.auth
        )
        self.assertEqual(second.status_code, 400)
