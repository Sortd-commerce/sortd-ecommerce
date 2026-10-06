from datetime import date
from decimal import Decimal
from io import StringIO

from accounts.models import User
from catalog.models import Category, Product, ProductVariant
from commerce.models import Cart, CartItem, Discount, Order, OrderLine
from django.core.management import call_command
from django.test import TestCase

from catalog.clear import clear_catalog_data


class ClearCatalogTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="shopper@example.com", password="secret123")
        category = Category.objects.create(name="Bars", slug="bars")
        self.product = Product.objects.create(title="Test bar", slug="test-bar", category=category, status="active")
        self.variant = ProductVariant.objects.create(
            product=self.product,
            sku="TST-001",
            title="Single",
            price=Decimal("10.00"),
            on_hand=5,
        )
        cart, _ = Cart.objects.get_or_create(user=self.user)
        CartItem.objects.create(cart=cart, variant=self.variant, quantity=1)
        self.order = Order.objects.create(
            user=self.user,
            number="ORD-1001",
            subtotal=Decimal("10.00"),
            total=Decimal("10.00"),
            delivery_date=date(2026, 10, 10),
            delivery_start="09:00",
            delivery_end="12:00",
            address_line1="Line 1",
            address_city="Dubai",
            address_postal_code="00000",
            idempotency_key="abc",
            request_hash="hash",
        )
        OrderLine.objects.create(
            order=self.order,
            variant=self.variant,
            title=self.product.title,
            sku=self.variant.sku,
            unit_price=self.variant.price,
            quantity=1,
            line_total=Decimal("10.00"),
        )
        Discount.objects.create(name="Launch", kind="percent", value=Decimal("10.00"), scope="all")

    def test_clear_catalog_data_removes_catalog_and_orders_but_keeps_users(self):
        result = clear_catalog_data(delete_media=False)
        self.assertGreaterEqual(result.products, 1)
        self.assertEqual(result.orders, 1)
        self.assertEqual(result.cart_items, 1)
        self.assertEqual(result.discounts, 1)
        self.assertFalse(Product.objects.exists())
        self.assertFalse(Category.objects.exists())
        self.assertFalse(Order.objects.exists())
        self.assertTrue(User.objects.filter(email="shopper@example.com").exists())

    def test_management_command(self):
        out = StringIO()
        call_command("clear_catalog_data", "--yes", stdout=out)
        self.assertIn("Cleared", out.getvalue())
        self.assertFalse(Product.objects.exists())
