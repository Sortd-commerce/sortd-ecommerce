from decimal import Decimal

from accounts.tests.helpers import PASSWORD, PHONE, ApiTestCase, bearer, login, post_json, signup_and_verify
from catalog.models import Category, Product, ProductStatus, ProductVariant
from catalog.tests.test_catalog import make_product
from commerce.models import Address, DeliveryWindow, DeliveryZone, Order, OrderStatus, PaymentMethod
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone


class AdminApiTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        verified = signup_and_verify(self.client)
        User = get_user_model()
        self.user = User.objects.get(email="ada@example.com")
        self.user.is_staff = True
        self.user.staff_role = "admin"
        self.user.save(update_fields=["is_staff", "staff_role"])
        self.auth = bearer(verified.json()["data"]["tokens"]["access"])
        self.category = Category.objects.create(name="Bars", slug="bars")

    def test_superuser_can_open_staff_console(self):
        User = get_user_model()
        User.objects.create_superuser(email="root@example.com", password=PASSWORD)
        signed_in = login(self.client, email="root@example.com", password=PASSWORD)
        self.assertEqual(signed_in.status_code, 200, signed_in.json())
        auth = bearer(signed_in.json()["data"]["tokens"]["access"])
        me = self.client.get("/api/v1/admin/me", **auth)
        self.assertEqual(me.status_code, 200, me.json())
        self.assertEqual(me.json()["data"]["role"], "admin")
        staff = self.client.get("/api/v1/staff/me", **auth)
        self.assertEqual(staff.status_code, 200, staff.json())
        self.assertEqual(staff.json()["data"]["role"], "admin")

    def test_healthz_is_public(self):
        response = self.client.get("/healthz")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        root = self.client.get("/")
        self.assertEqual(root.status_code, 200)

    def test_superuser_without_staff_flag_still_counts_as_admin(self):
        User = get_user_model()
        root = User.objects.create_superuser(email="owner@example.com", password=PASSWORD)
        root.is_staff = False
        root.staff_role = ""
        root.save(update_fields=["is_staff", "staff_role"])
        signed_in = login(self.client, email="owner@example.com", password=PASSWORD)
        auth = bearer(signed_in.json()["data"]["tokens"]["access"])
        me = self.client.get("/api/v1/admin/me", **auth)
        self.assertEqual(me.status_code, 200, me.json())
        self.assertEqual(me.json()["data"]["role"], "admin")

    def test_non_staff_is_forbidden(self):
        other = signup_and_verify(self.client, email="customer@example.com")
        auth = bearer(other.json()["data"]["tokens"]["access"])
        response = self.client.get("/api/v1/admin/analytics/overview", **auth)
        self.assertEqual(response.status_code, 403)

    def test_analytics_and_product_create(self):
        created = post_json(
            self.client,
            "/api/v1/admin/products",
            {
                "title": "Sea Salt Bar",
                "category_id": self.category.id,
                "status": "active",
                "variant_sku": "SEA-SALT-1",
                "price": "18.50",
                "on_hand": 12,
            },
            **self.auth,
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["data"]["variants"][0]["on_hand"], 12)

        overview = self.client.get("/api/v1/admin/analytics/overview", **self.auth)
        self.assertEqual(overview.status_code, 200)
        self.assertEqual(overview.json()["data"]["products_active"], 1)

        listed = self.client.get("/api/v1/admin/products?page_size=10", **self.auth)
        self.assertEqual(listed.status_code, 200)
        row = listed.json()["data"]["results"][0]
        self.assertEqual(row["title"], "Sea Salt Bar")
        self.assertIn("variants", row)
        self.assertNotIn("label", row)
        self.assertNotIn("images", row)

    def test_delivery_window_crud(self):
        created = post_json(
            self.client,
            "/api/v1/admin/delivery/windows",
            {
                "weekday": 1,
                "start_time": "09:00:00",
                "end_time": "12:00:00",
                "capacity": 20,
                "cutoff_minutes": 60,
                "is_active": True,
            },
            **self.auth,
        )
        self.assertEqual(created.status_code, 201)
        window_id = created.json()["data"]["id"]

        updated = self.client.patch(
            f"/api/v1/admin/delivery/windows/{window_id}",
            data={
                "weekday": 1,
                "start_time": "10:00:00",
                "end_time": "13:00:00",
                "capacity": 15,
                "cutoff_minutes": 30,
                "is_active": True,
            },
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["data"]["capacity"], 15)

    def test_order_status_update(self):
        product, variant = make_product(on_hand=3)
        PaymentMethod.objects.get_or_create(code="cod", defaults={"name": "Cash on delivery"})
        DeliveryZone.objects.filter(slug="dubai-marina").update(is_active=True)
        tomorrow = (timezone.now() + timedelta(days=1)).date()
        window = DeliveryWindow.objects.create(
            weekday=tomorrow.weekday(),
            start_time="09:00:00",
            end_time="12:00:00",
            capacity=5,
            cutoff_minutes=0,
            is_active=True,
        )
        from commerce.models import Address

        address = Address.objects.create(
            user=self.user,
            line1="Marina",
            city="Dubai",
            formatted_address="dubai marina",
            place_id="fixture-dubai-marina",
        )
        post_json(
            self.client,
            "/api/v1/cart/items",
            {"items": [{"variant_id": variant.id, "quantity": 1}]},
            **self.auth,
        )
        placed = post_json(
            self.client,
            "/api/v1/orders",
            {
                "address_id": address.id,
                "delivery_date": tomorrow.isoformat(),
                "window_id": window.id,
                "window_source": "weekly",
                "expected_total": "16.90",
                "payment_method": "cod",
            },
            HTTP_IDEMPOTENCY_KEY="admin-order-1",
            **self.auth,
        )
        self.assertEqual(placed.status_code, 201)
        number = placed.json()["data"]["number"]

        confirmed = self.client.patch(
            f"/api/v1/admin/orders/{number}",
            data={"status": "confirmed"},
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(confirmed.status_code, 200)
        self.assertEqual(confirmed.json()["data"]["status"], "confirmed")

        dispatched = self.client.patch(
            f"/api/v1/admin/orders/{number}",
            data={"status": "out_for_delivery"},
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(dispatched.status_code, 200)
        self.assertEqual(dispatched.json()["data"]["status"], "out_for_delivery")

    def test_placed_order_can_move_directly_to_out_for_delivery(self):
        tomorrow = (timezone.now() + timedelta(days=1)).date()
        window = DeliveryWindow.objects.create(
            weekday=tomorrow.weekday(),
            start_time="09:00:00",
            end_time="12:00:00",
            capacity=2,
            cutoff_minutes=0,
            is_active=True,
        )
        address = Address.objects.create(
            user=self.user,
            line1="Marina Walk",
            city="Dubai",
            formatted_address="Dubai Marina",
            place_id="fixture-dubai-marina",
        )
        placed = post_json(
            self.client,
            "/api/v1/orders",
            {
                "address_id": address.id,
                "delivery_date": tomorrow.isoformat(),
                "window_id": window.id,
                "window_source": "weekly",
                "expected_total": "16.90",
                "payment_method": "cod",
            },
            HTTP_IDEMPOTENCY_KEY="admin-order-direct-dispatch",
            **self.auth,
        )
        self.assertEqual(placed.status_code, 201)
        number = placed.json()["data"]["number"]

        dispatched = self.client.patch(
            f"/api/v1/admin/orders/{number}",
            data={"status": "out_for_delivery"},
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(dispatched.status_code, 200)
        self.assertEqual(dispatched.json()["data"]["status"], "out_for_delivery")

    def test_out_for_delivery_order_can_move_back_to_placed(self):
        tomorrow = (timezone.now() + timedelta(days=1)).date()
        window = DeliveryWindow.objects.create(
            weekday=tomorrow.weekday(),
            start_time="09:00:00",
            end_time="12:00:00",
            capacity=2,
            cutoff_minutes=0,
            is_active=True,
        )
        address = Address.objects.create(
            user=self.user,
            line1="Marina Walk",
            city="Dubai",
            formatted_address="Dubai Marina",
            place_id="fixture-dubai-marina",
        )
        placed = post_json(
            self.client,
            "/api/v1/orders",
            {
                "address_id": address.id,
                "delivery_date": tomorrow.isoformat(),
                "window_id": window.id,
                "window_source": "weekly",
                "expected_total": "16.90",
                "payment_method": "cod",
            },
            HTTP_IDEMPOTENCY_KEY="admin-order-revert-placed",
            **self.auth,
        )
        number = placed.json()["data"]["number"]

        dispatched = self.client.patch(
            f"/api/v1/admin/orders/{number}",
            data={"status": "out_for_delivery"},
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(dispatched.status_code, 200)

        reverted = self.client.patch(
            f"/api/v1/admin/orders/{number}",
            data={"status": "placed"},
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(reverted.status_code, 200)
        self.assertEqual(reverted.json()["data"]["status"], "placed")

    def test_staff_can_create_pack_offers_and_flavour_links(self):
        first = post_json(
            self.client,
            "/api/v1/admin/products",
            {
                "title": "Coffee Cocoa Bar",
                "category_id": self.category.id,
                "status": "active",
                "variant_sku": "COF-1",
                "price": "16.90",
                "on_hand": 8,
            },
            **self.auth,
        )
        self.assertEqual(first.status_code, 201)
        created = post_json(
            self.client,
            "/api/v1/admin/products",
            {
                "title": "Raspberry Bar",
                "category_id": self.category.id,
                "status": "active",
                "variants": [
                    {"sku": "RAS-1", "title": "Single bar", "price": "16.90", "unit_count": 1, "on_hand": 10},
                    {"sku": "RAS-5", "title": "Pack of 5", "price": "79.90", "unit_count": 5, "on_hand": 4},
                ],
                "related_slugs": ["coffee-cocoa-bar"],
                "label": {
                    "headline": "Protein-led. 20.3 g in every bar.",
                    "serving_basis": "PER BAR",
                    "serving_size": "67 g",
                    "facts": [{"name": "Protein", "amount": "20.3", "unit": "g", "is_highlight": True}],
                    "ingredients": [{"name": "Cashews", "share_percent": "35"}],
                    "allergens": [{"name": "Tree nuts", "detail": "cashews"}],
                    "hidden_sugars_found": 0,
                    "shares_printed": True,
                },
            },
            **self.auth,
        )
        self.assertEqual(created.status_code, 201)
        data = created.json()["data"]
        self.assertEqual(len(data["variants"]), 2)
        self.assertEqual(data["variants"][1]["unit_count"], 5)
        self.assertEqual(data["related"][0]["slug"], "coffee-cocoa-bar")
        self.assertEqual(data["label"]["ingredients"][0]["share_percent"], "35.00")
        self.assertEqual(data["label"]["checks"]["hidden_sugars_found"], 0)
        from django.core.files.uploadedfile import SimpleUploadedFile
        from catalog.models import ProductImage

        product, _ = make_product()
        jpeg = SimpleUploadedFile("hero.jpg", b"\xff\xd8\xff\xd9xx", content_type="image/jpeg")
        uploaded = self.client.post(
            f"/api/v1/admin/products/{product.id}/images",
            data={"file": jpeg, "alt": "Hero"},
            **self.auth,
        )
        self.assertEqual(uploaded.status_code, 201)
        payload = uploaded.json()["data"]
        self.assertEqual(payload["role"], "primary")
        self.assertEqual(payload["original_name"], "hero.jpg")
        self.assertGreater(payload["byte_size"], 0)
        self.assertTrue(payload["created_at"])
        second = SimpleUploadedFile("detail.jpg", b"\xff\xd8\xff\xd9yy", content_type="image/jpeg")
        extra = self.client.post(
            f"/api/v1/admin/products/{product.id}/images",
            data={"file": second, "alt": "Detail"},
            **self.auth,
        )
        self.assertEqual(extra.status_code, 201)
        self.assertEqual(extra.json()["data"]["role"], "secondary")
        promoted = self.client.post(
            f"/api/v1/admin/products/{product.id}/images/{extra.json()['data']['id']}/first",
            **self.auth,
        )
        self.assertEqual(promoted.status_code, 200)
        self.assertEqual(promoted.json()["data"]["images"][0]["id"], extra.json()["data"]["id"])
        self.assertEqual(promoted.json()["data"]["images"][0]["role"], "primary")
        self.assertEqual(ProductImage.objects.filter(product=product).count(), 2)

        reordered = self.client.patch(
            f"/api/v1/admin/products/{product.id}/images/order",
            data={"image_ids": [payload["id"], extra.json()["data"]["id"]]},
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(reordered.status_code, 200)
        self.assertEqual(reordered.json()["data"]["images"][0]["id"], payload["id"])

        deleted = self.client.delete(
            f"/api/v1/admin/products/{product.id}/images/{payload['id']}",
            **self.auth,
        )
        self.assertEqual(deleted.status_code, 200)
        remaining = ProductImage.objects.filter(product=product)
        self.assertEqual(remaining.count(), 1)
        self.assertEqual(remaining.get().role, "primary")

    def test_staff_can_get_and_update_existing_product(self):
        created = post_json(
            self.client,
            "/api/v1/admin/products",
            {
                "title": "Plain Bar",
                "category_id": self.category.id,
                "status": "active",
                "variant_sku": "PLAIN-1",
                "price": "12.00",
                "on_hand": 4,
            },
            **self.auth,
        )
        self.assertEqual(created.status_code, 201)
        product_id = created.json()["data"]["id"]
        variant_id = created.json()["data"]["variants"][0]["id"]

        fetched = self.client.get(f"/api/v1/admin/products/{product_id}", **self.auth)
        self.assertEqual(fetched.status_code, 200)
        self.assertIsNone(fetched.json()["data"]["label"])

        updated = self.client.patch(
            f"/api/v1/admin/products/{product_id}",
            data={
                "title": "Plain Bar, Sea Salt",
                "description": "Edited copy",
                "status": "active",
                "category_id": self.category.id,
                "related_slugs": [],
                "label": {
                    "serving_size": "60 g",
                    "headline": "Edited headline",
                    "facts": [{"name": "Protein", "amount": "20", "unit": "g"}],
                    "ingredients": [{"name": "Cashews", "share_percent": "35.00"}],
                    "allergens": [{"name": "Tree nuts", "detail": "cashews"}],
                },
            },
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(updated.status_code, 200, updated.json())
        self.assertEqual(updated.json()["data"]["title"], "Plain Bar, Sea Salt")
        self.assertEqual(updated.json()["data"]["label"]["headline"], "Edited headline")

        offer = self.client.patch(
            f"/api/v1/admin/variants/{variant_id}",
            data={"title": "Pack of 5", "price": "75.00", "unit_count": 5, "is_active": True},
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(offer.status_code, 200, offer.json())
        self.assertEqual(offer.json()["data"]["title"], "Pack of 5")
        self.assertEqual(offer.json()["data"]["unit_count"], 5)

    @override_settings(
        CLOUDINARY_ENABLED=True,
        CLOUDINARY_CLOUD_NAME="demo",
        CLOUDINARY_API_KEY="key",
        CLOUDINARY_API_SECRET="secret",
    )
    @patch("core.cloudinary_storage.cloudinary.uploader.upload")
    def test_image_upload_returns_cloudinary_permission_error(self, mock_upload):
        mock_upload.side_effect = Exception(
            'Request forbidden due to missing permissions (actions=["create"])'
        )
        product, _ = make_product()
        jpeg = SimpleUploadedFile("hero.jpg", b"\xff\xd8\xff\xd9xx", content_type="image/jpeg")
        uploaded = self.client.post(
            f"/api/v1/admin/products/{product.id}/images",
            data={"file": jpeg, "alt": "Hero"},
            **self.auth,
        )
        self.assertEqual(uploaded.status_code, 422)
        self.assertIn("cannot create assets", uploaded.json()["message"])

    def test_member_can_view_orders_but_not_mutate(self):
        User = get_user_model()
        member = signup_and_verify(self.client, email="viewer@example.com")
        viewer = User.objects.get(email="viewer@example.com")
        viewer.is_staff = True
        viewer.staff_role = "member"
        viewer.save(update_fields=["is_staff", "staff_role"])
        auth = bearer(member.json()["data"]["tokens"]["access"])

        me = self.client.get("/api/v1/admin/me", **auth)
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["data"]["role"], "member")

        orders = self.client.get("/api/v1/admin/orders", **auth)
        self.assertEqual(orders.status_code, 200)

        blocked = self.client.get("/api/v1/admin/products", **auth)
        self.assertEqual(blocked.status_code, 403)
        analytics = self.client.get("/api/v1/admin/analytics/overview", **auth)
        self.assertEqual(analytics.status_code, 403)

    def test_admin_can_add_and_remove_members(self):
        created = post_json(
            self.client,
            "/api/v1/admin/members",
            {
                "email": "picker@example.com",
                "first_name": "Pat",
                "last_name": "Lee",
                "password": PASSWORD,
                "role": "member",
            },
            **self.auth,
        )
        self.assertEqual(created.status_code, 201, created.json())
        member_id = created.json()["data"]["id"]
        listed = self.client.get("/api/v1/admin/members", **self.auth)
        emails = [row["email"] for row in listed.json()["data"]["results"]]
        self.assertIn("picker@example.com", emails)

        removed = self.client.delete(f"/api/v1/admin/members/{member_id}", **self.auth)
        self.assertEqual(removed.status_code, 200)

    def test_delivery_zone_can_be_updated_and_deleted(self):
        created = post_json(
            self.client,
            "/api/v1/admin/delivery/zones",
            {
                "name": "Test Zone",
                "slug": "test-zone",
                "polygon": [[55.13, 25.07], [55.15, 25.07], [55.15, 25.09], [55.13, 25.09]],
                "delivery_fee": "12.00",
                "is_active": True,
            },
            **self.auth,
        )
        self.assertEqual(created.status_code, 201)
        zone_id = created.json()["data"]["id"]
        updated = self.client.patch(
            f"/api/v1/admin/delivery/zones/{zone_id}",
            data={"is_active": False},
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(updated.status_code, 200)
        self.assertFalse(updated.json()["data"]["is_active"])
        deleted = self.client.delete(f"/api/v1/admin/delivery/zones/{zone_id}", **self.auth)
        self.assertEqual(deleted.status_code, 200)
        self.assertFalse(DeliveryZone.objects.filter(pk=zone_id).exists())
