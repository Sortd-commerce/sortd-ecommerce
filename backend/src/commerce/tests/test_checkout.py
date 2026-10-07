from datetime import timedelta
from decimal import Decimal
import json

from django.core import mail
from django.utils import timezone

from accounts.tests.helpers import ApiTestCase, bearer, post_json, signup_and_verify
from catalog.tests.test_catalog import make_product
from commerce.models import (
    Address,
    CommerceSettings,
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
        settings = CommerceSettings.load()
        settings.delivery_fee = Decimal("0.00")
        settings.free_delivery_minimum = Decimal("0.00")
        settings.save()

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

    def test_delivery_accepts_dubai_when_postal_allowlist_empty(self):
        DeliveryPostalCode.objects.all().delete()

        dubai = post_json(self.client, "/api/v1/delivery/check", {"address": "dubai marina"})
        self.assertEqual(dubai.status_code, 200)
        self.assertTrue(dubai.json()["data"]["serviceable"])

        blocked = post_json(self.client, "/api/v1/delivery/check", {"address": "outside"})
        self.assertFalse(blocked.json()["data"]["serviceable"])

    def test_delivery_autocomplete_returns_fixture_suggestions(self):
        response = post_json(self.client, "/api/v1/delivery/autocomplete", {"q": "marina"})
        self.assertEqual(response.status_code, 200)
        rows = response.json()["data"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["place_id"], "fixture-dubai-marina")

    def test_delivery_check_accepts_lat_lng(self):
        response = post_json(
            self.client,
            "/api/v1/delivery/check",
            {"latitude": "25.080500", "longitude": "55.140300"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["data"]["serviceable"])
        self.assertEqual(response.json()["data"]["place_id"], "fixture-dubai-marina")

    def test_address_save_rejects_unserviceable_place(self):
        response = post_json(
            self.client,
            "/api/v1/addresses",
            {
                "line1": "Somewhere",
                "city": "Abu Dhabi",
                "place_id": "fixture-abu-dhabi",
                "formatted_address": "outside",
                "is_default": True,
            },
            **self.auth,
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["message"], ErrorMessage.NOT_SERVICEABLE)
        self.assertEqual(Address.objects.filter(user=self.user).count(), 1)

    def test_address_save_persists_geocoded_serviceable_place(self):
        response = post_json(
            self.client,
            "/api/v1/addresses",
            {
                "place_id": "fixture-dubai-marina",
                "is_default": True,
            },
            **self.auth,
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()["data"]
        self.assertEqual(data["postal_code"], "00000")
        self.assertEqual(data["place_id"], "fixture-dubai-marina")
        self.assertTrue(data["formatted_address"])
        self.assertEqual(data["latitude"], "25.080500")
        self.assertEqual(data["longitude"], "55.140300")

    def test_validate_checkout_before_payment(self):
        self._add_to_cart(1)
        payload = {
            "address_id": self.address.id,
            "delivery_date": self.tomorrow.isoformat(),
            "window_id": self.window.id,
            "window_source": "weekly",
            "payment_method": "cod",
        }
        response = post_json(self.client, "/api/v1/orders/validate", payload, **self.auth)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["total"], "16.90")

    def test_validate_rejects_unserviceable_address(self):
        self._add_to_cart(1)
        outside = Address.objects.create(
            user=self.user,
            line1="Outside",
            city="Abu Dhabi",
            formatted_address="outside",
            place_id="fixture-abu-dhabi",
        )
        payload = {
            "address_id": outside.id,
            "delivery_date": self.tomorrow.isoformat(),
            "window_id": self.window.id,
            "window_source": "weekly",
            "payment_method": "card",
        }
        response = post_json(self.client, "/api/v1/orders/validate", payload, **self.auth)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["message"], ErrorMessage.NOT_SERVICEABLE)

    def test_cart_sync_skips_unavailable_variants(self):
        response = self.client.put(
            "/api/v1/cart/sync",
            data=json.dumps({"items": [{"variant_id": self.variant.id, "quantity": 1}, {"variant_id": 999999, "quantity": 1}]}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(len(data["items"]), 1)
        self.assertEqual(data["items"][0]["variant_id"], self.variant.id)
        self.assertEqual(data["skipped_variant_ids"], [999999])

    def test_cart_sync_replaces_client_lines(self):
        first = self.client.put(
            "/api/v1/cart/sync",
            data=json.dumps({"items": [{"variant_id": self.variant.id, "quantity": 2}]}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["data"]["items"][0]["quantity"], 2)
        replaced = self.client.put(
            "/api/v1/cart/sync",
            data=json.dumps({"items": [{"variant_id": self.variant.id, "quantity": 1}]}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(replaced.json()["data"]["items"][0]["quantity"], 1)
        emptied = self.client.put(
            "/api/v1/cart/sync",
            data=json.dumps({"items": []}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(emptied.json()["data"]["items"], [])

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
        self.assertIn(response.json()["data"]["number"], mail.outbox[-1].subject)
        self.assertIn("confirmed", mail.outbox[-1].subject.lower())

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
        mail.outbox.clear()
        cancelled = post_json(self.client, f"/api/v1/orders/{number}/cancel", {}, **self.auth)
        self.assertEqual(cancelled.status_code, 200)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.on_hand, 5)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(number, mail.outbox[-1].subject)
        self.assertIn("cancelled", mail.outbox[-1].subject.lower())
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

    def test_payment_methods_come_from_the_catalog(self):
        PaymentMethod.objects.get_or_create(code="card", defaults={"name": "Card", "is_active": False})
        response = self.client.get("/api/v1/payments/methods")
        self.assertEqual(response.status_code, 200)
        rows = {row["code"]: row for row in response.json()["data"]}
        self.assertTrue(rows["cod"]["is_active"])
        self.assertEqual(rows["cod"]["name"], "Cash on delivery")
        self.assertIn("card", rows)
        self.assertFalse(rows["card"]["is_active"])

    def test_inactive_payment_method_is_rejected(self):
        PaymentMethod.objects.update_or_create(code="card", defaults={"name": "Card", "is_active": False})
        self._add_to_cart(1)
        response = post_json(
            self.client,
            "/api/v1/orders",
            self._order_payload(payment_method="card"),
            HTTP_IDEMPOTENCY_KEY="pay-1",
            **self.auth,
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_quote_adds_delivery_fee_until_free_minimum(self):
        settings = CommerceSettings.load()
        settings.delivery_fee = Decimal("9.00")
        settings.free_delivery_minimum = Decimal("99.00")
        settings.save()
        response = post_json(
            self.client,
            "/api/v1/pricing/quote",
            {"items": [{"variant_id": self.variant.id, "quantity": 1}]},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["subtotal"], "16.90")
        self.assertEqual(data["delivery_fee"], "9.00")
        self.assertEqual(data["amount_until_free_delivery"], "82.10")
        self.assertEqual(data["total"], "25.90")

    def test_quote_waives_delivery_at_minimum(self):
        settings = CommerceSettings.load()
        settings.delivery_fee = Decimal("9.00")
        settings.free_delivery_minimum = Decimal("16.90")
        settings.save()
        response = post_json(
            self.client,
            "/api/v1/pricing/quote",
            {"items": [{"variant_id": self.variant.id, "quantity": 1}]},
        )
        data = response.json()["data"]
        self.assertEqual(data["delivery_fee"], "0.00")
        self.assertEqual(data["total"], "16.90")

    def test_automatic_global_discount_is_applied(self):
        Discount.objects.create(
            name="Launch",
            kind=Discount.Kind.PERCENT,
            value=Decimal("10"),
            scope=Discount.Scope.ALL,
            is_active=True,
        )
        response = post_json(
            self.client,
            "/api/v1/pricing/quote",
            {"items": [{"variant_id": self.variant.id, "quantity": 1}]},
        )
        data = response.json()["data"]
        self.assertEqual(data["discount_amount"], "1.69")
        self.assertEqual(data["total"], "15.21")

    def test_product_discount_only_applies_to_that_product(self):
        other, other_variant = make_product(slug="other-bar", title="Other Bar", on_hand=5)
        Discount.objects.create(
            name="Bar deal",
            kind=Discount.Kind.FIXED,
            value=Decimal("5.00"),
            scope=Discount.Scope.PRODUCT,
            product=self.product,
            is_active=True,
        )
        response = post_json(
            self.client,
            "/api/v1/pricing/quote",
            {
                "items": [
                    {"variant_id": self.variant.id, "quantity": 1},
                    {"variant_id": other_variant.id, "quantity": 1},
                ]
            },
        )
        data = response.json()["data"]
        self.assertEqual(data["subtotal"], "33.80")
        self.assertEqual(data["discount_amount"], "5.00")
        self.assertEqual(data["total"], "28.80")

    def test_order_includes_delivery_fee(self):
        settings = CommerceSettings.load()
        settings.delivery_fee = Decimal("9.00")
        settings.free_delivery_minimum = Decimal("99.00")
        settings.save()
        self._add_to_cart(1)
        response = post_json(
            self.client,
            "/api/v1/orders",
            self._order_payload(total="25.90"),
            HTTP_IDEMPOTENCY_KEY="delivery-fee",
            **self.auth,
        )
        self.assertEqual(response.status_code, 201)
        order = response.json()["data"]
        self.assertEqual(order["delivery_fee"], "9.00")
        self.assertEqual(order["total"], "25.90")

    def test_address_can_be_updated(self):
        response = self.client.patch(
            f"/api/v1/addresses/{self.address.id}",
            data=json.dumps({"place_id": "fixture-dubai-marina", "is_default": True}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        self.address.refresh_from_db()
        self.assertEqual(self.address.place_id, "fixture-dubai-marina")
        self.assertEqual(self.address.postal_code, "00000")
        self.assertTrue(self.address.is_default)

    def test_first_order_coupon_works_once(self):
        Discount.objects.create(
            code="WELCOME10",
            name="Welcome offer",
            kind=Discount.Kind.PERCENT,
            value=Decimal("10"),
            scope=Discount.Scope.ALL,
            first_order_only=True,
            is_active=True,
        )
        self._add_to_cart(1)
        first_quote = post_json(
            self.client,
            "/api/v1/pricing/quote",
            {"items": [{"variant_id": self.variant.id, "quantity": 1}], "discount_code": "WELCOME10"},
            **self.auth,
        )
        self.assertEqual(first_quote.status_code, 200)
        self.assertEqual(first_quote.json()["data"]["discount_amount"], "1.69")

        first_order = post_json(
            self.client,
            "/api/v1/orders",
            self._order_payload(total=first_quote.json()["data"]["total"], discount_code="WELCOME10"),
            HTTP_IDEMPOTENCY_KEY="welcome-first",
            **self.auth,
        )
        self.assertEqual(first_order.status_code, 201)

        self._add_to_cart(1)
        repeat_quote = post_json(
            self.client,
            "/api/v1/pricing/quote",
            {"items": [{"variant_id": self.variant.id, "quantity": 1}], "discount_code": "WELCOME10"},
            **self.auth,
        )
        self.assertEqual(repeat_quote.status_code, 400)
        self.assertEqual(repeat_quote.json()["message"], "This code is for first orders only.")

    def test_first_order_coupon_requires_sign_in(self):
        Discount.objects.create(
            code="WELCOME10",
            name="Welcome offer",
            kind=Discount.Kind.PERCENT,
            value=Decimal("10"),
            scope=Discount.Scope.ALL,
            first_order_only=True,
            is_active=True,
        )
        response = post_json(
            self.client,
            "/api/v1/pricing/quote",
            {"items": [{"variant_id": self.variant.id, "quantity": 1}], "discount_code": "WELCOME10"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["message"], "Sign in to use this code.")

    def test_used_first_order_coupon_is_omitted_from_preview(self):
        Discount.objects.create(
            code="WELCOME10",
            name="Welcome offer",
            kind=Discount.Kind.PERCENT,
            value=Decimal("10"),
            scope=Discount.Scope.ALL,
            first_order_only=True,
            is_active=True,
        )
        self._add_to_cart(1)
        first_quote = post_json(
            self.client,
            "/api/v1/pricing/quote",
            {"items": [{"variant_id": self.variant.id, "quantity": 1}], "discount_code": "WELCOME10"},
            **self.auth,
        )
        post_json(
            self.client,
            "/api/v1/orders",
            self._order_payload(total=first_quote.json()["data"]["total"], discount_code="WELCOME10"),
            HTTP_IDEMPOTENCY_KEY="welcome-preview",
            **self.auth,
        )
        self._add_to_cart(1)
        preview = post_json(
            self.client,
            "/api/v1/pricing/coupons/preview",
            {"items": [{"variant_id": self.variant.id, "quantity": 1}]},
            **self.auth,
        )
        self.assertEqual(preview.status_code, 200)
        codes = [row["code"] for row in preview.json()["data"]]
        self.assertNotIn("WELCOME10", codes)

    def test_pricing_rules_expose_delivery_promise(self):
        settings = CommerceSettings.load()
        settings.delivery_promise = "Same-day delivery across Dubai"
        settings.free_delivery_minimum = Decimal("0.00")
        settings.save()

        response = self.client.get("/api/v1/pricing")
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["delivery_promise"], "Same-day delivery across Dubai")
        self.assertEqual(data["free_delivery_minimum"], "0.00")

    def test_pricing_rules_allow_blank_delivery_promise(self):
        settings = CommerceSettings.load()
        settings.delivery_promise = "null"
        settings.save()

        response = self.client.get("/api/v1/pricing")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["delivery_promise"], "")
