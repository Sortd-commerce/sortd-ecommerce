from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


class Address(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="addresses")
    line1 = models.CharField(max_length=200)
    line2 = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=120)
    region = models.CharField(max_length=120, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=2, default="AE")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    place_id = models.CharField(max_length=256, blank=True)
    formatted_address = models.CharField(max_length=400, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_default", "-id"]


class DeliveryPostalCode(models.Model):
    code = models.CharField(max_length=16, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]

    def save(self, *args, **kwargs):
        self.code = normalize_postal_code(self.code)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.code


class DeliveryWindow(models.Model):
    weekday = models.PositiveSmallIntegerField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    capacity = models.PositiveIntegerField()
    cutoff_minutes = models.PositiveIntegerField(default=60)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["weekday", "start_time"]


class DeliveryDateOverride(models.Model):
    class Kind(models.TextChoices):
        CLOSED = "closed", "Closed"
        REPLACE = "replace", "Replace"

    date = models.DateField(unique=True)
    kind = models.CharField(max_length=16, choices=Kind.choices)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["date"]


class DeliveryOverrideWindow(models.Model):
    override = models.ForeignKey(DeliveryDateOverride, on_delete=models.CASCADE, related_name="windows")
    start_time = models.TimeField()
    end_time = models.TimeField()
    capacity = models.PositiveIntegerField()
    cutoff_minutes = models.PositiveIntegerField(default=60)

    class Meta:
        ordering = ["start_time"]


class CommerceSettings(models.Model):
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    free_delivery_minimum = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "CommerceSettings":
        row, _ = cls.objects.get_or_create(pk=1)
        return row


class PaymentMethod(models.Model):
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=80)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.code


class Discount(models.Model):
    class Kind(models.TextChoices):
        PERCENT = "percent", "Percent"
        FIXED = "fixed", "Fixed"

    class Benefit(models.TextChoices):
        MERCHANDISE = "merchandise", "Merchandise discount"
        FREE_DELIVERY = "free_delivery", "Free delivery"

    class Scope(models.TextChoices):
        ALL = "all", "All"
        PRODUCT = "product", "Product"
        VARIANT = "variant", "Variant"
        CATEGORY = "category", "Category"

    name = models.CharField(max_length=120)
    headline = models.CharField(max_length=120, blank=True)
    detail = models.CharField(max_length=240, blank=True)
    kind = models.CharField(max_length=16, choices=Kind.choices)
    benefit = models.CharField(max_length=20, choices=Benefit.choices, default=Benefit.MERCHANDISE)
    value = models.DecimalField(max_digits=10, decimal_places=2)
    code = models.CharField(max_length=40, unique=True, null=True, blank=True)
    scope = models.CharField(max_length=16, choices=Scope.choices, default=Scope.ALL)
    product = models.ForeignKey("catalog.Product", null=True, blank=True, on_delete=models.CASCADE)
    variant = models.ForeignKey("catalog.ProductVariant", null=True, blank=True, on_delete=models.CASCADE)
    category = models.ForeignKey("catalog.Category", null=True, blank=True, on_delete=models.CASCADE)
    minimum_order = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    max_discount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    first_order_only = models.BooleanField(default=False)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name


class Cart(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cart")
    updated_at = models.DateTimeField(auto_now=True)


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    variant = models.ForeignKey("catalog.ProductVariant", on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["cart", "variant"], name="unique_cart_variant"),
        ]


class OrderStatus(models.TextChoices):
    PLACED = "placed", "Placed"
    CONFIRMED = "confirmed", "Confirmed"
    OUT_FOR_DELIVERY = "out_for_delivery", "Out for delivery"
    DELIVERED = "delivered", "Delivered"
    CANCELLED = "cancelled", "Cancelled"


class PaymentStatus(models.TextChoices):
    UNPAID = "unpaid", "Unpaid"
    PAID = "paid", "Paid"


class Order(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="orders")
    number = models.CharField(max_length=32, unique=True)
    status = models.CharField(max_length=32, choices=OrderStatus.choices, default=OrderStatus.PLACED)
    payment_method = models.CharField(max_length=32, default="cod")
    payment_status = models.CharField(max_length=16, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID)
    stripe_payment_intent_id = models.CharField(max_length=128, blank=True)
    currency = models.CharField(max_length=3, default="AED")
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    discount_code = models.CharField(max_length=40, blank=True)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=10, decimal_places=2)
    note = models.TextField(blank=True)
    delivery_date = models.DateField()
    delivery_start = models.TimeField()
    delivery_end = models.TimeField()
    window_id = models.PositiveIntegerField(null=True, blank=True)
    address_line1 = models.CharField(max_length=200)
    address_line2 = models.CharField(max_length=200, blank=True)
    address_city = models.CharField(max_length=120)
    address_region = models.CharField(max_length=120, blank=True)
    address_postal_code = models.CharField(max_length=20)
    address_country = models.CharField(max_length=2, default="AE")
    address_formatted = models.CharField(max_length=400, blank=True)
    address_place_id = models.CharField(max_length=256, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    idempotency_key = models.CharField(max_length=80)
    request_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "idempotency_key"], name="unique_order_idempotency"),
        ]

    def __str__(self) -> str:
        return self.number


class OrderLine(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="lines")
    variant = models.ForeignKey("catalog.ProductVariant", null=True, on_delete=models.SET_NULL)
    title = models.CharField(max_length=200)
    sku = models.CharField(max_length=64)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()
    line_total = models.DecimalField(max_digits=10, decimal_places=2)


def normalize_postal_code(value: str) -> str:
    return "".join(ch for ch in (value or "").upper() if ch.isalnum())
