from django.db import models
from django.utils.text import slugify

from core.assets import private_media_storage, public_media_storage
from core.uploads import validate_image_file, validate_report_file


class ProductStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    ACTIVE = "active", "Active"
    ARCHIVED = "archived", "Archived"


class ImageRole(models.TextChoices):
    PRIMARY = "primary", "Primary"
    SECONDARY = "secondary", "Secondary"


class RelatedKind(models.TextChoices):
    FLAVOR = "flavor", "Flavor"
    RELATED = "related", "Related"


class TrafficLevel(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"


class StockMovementKind(models.TextChoices):
    SALE = "sale", "Sale"
    RESTOCK = "restock", "Restock"
    ADJUSTMENT = "adjustment", "Adjustment"
    CANCELLATION = "cancellation", "Cancellation"


class Category(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children")
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    image = models.FileField(
        upload_to="categories/images/",
        storage=public_media_storage,
        validators=[validate_image_file],
        blank=True,
    )

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Product(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    brand = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    shelf = models.CharField(max_length=120, blank=True)
    tags = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=ProductStatus.choices, default=ProductStatus.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title"]
        indexes = [
            models.Index(fields=["status", "category"], name="catalog_product_status_cat"),
        ]

    def __str__(self) -> str:
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    file = models.FileField(
        upload_to="products/images/",
        storage=public_media_storage,
        validators=[validate_image_file],
    )
    alt = models.CharField(max_length=200, blank=True)
    original_name = models.CharField(max_length=255, blank=True)
    byte_size = models.PositiveIntegerField(default=0)
    sort_order = models.PositiveIntegerField(default=0)
    role = models.CharField(max_length=20, choices=ImageRole.choices, default=ImageRole.SECONDARY)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]


class ProductVariant(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    sku = models.CharField(max_length=64, unique=True)
    title = models.CharField(max_length=120)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    compare_at_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    unit_count = models.PositiveIntegerField(default=1)
    max_order = models.PositiveIntegerField(null=True, blank=True)
    on_hand = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.product.title} ({self.sku})"


class NutritionProfile(models.Model):
    product = models.OneToOneField(Product, on_delete=models.CASCADE, related_name="nutrition")
    serving_size = models.CharField(max_length=80, blank=True)
    serving_basis = models.CharField(max_length=80, blank=True)
    headline = models.CharField(max_length=200, blank=True)
    note = models.CharField(max_length=400, blank=True)
    guidance = models.CharField(max_length=400, blank=True)
    nutritionist_note = models.CharField(max_length=400, blank=True)
    hidden_sugars_found = models.PositiveIntegerField(default=0)
    banned_ingredients_found = models.PositiveIntegerField(default=0)
    shares_printed = models.BooleanField(default=True)
    sugar_source = models.CharField(max_length=200, blank=True)


class NutritionFact(models.Model):
    profile = models.ForeignKey(NutritionProfile, on_delete=models.CASCADE, related_name="facts")
    name = models.CharField(max_length=80)
    amount = models.CharField(max_length=40)
    unit = models.CharField(max_length=24, blank=True)
    daily_value = models.CharField(max_length=24, blank=True)
    is_highlight = models.BooleanField(default=False)
    level = models.CharField(max_length=16, blank=True, choices=TrafficLevel.choices)
    note = models.CharField(max_length=200, blank=True)
    group = models.CharField(max_length=80, blank=True)
    is_subfact = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]


class Ingredient(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="ingredients")
    name = models.CharField(max_length=160)
    share_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    detail = models.CharField(max_length=200, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_flagged = models.BooleanField(default=False)

    class Meta:
        ordering = ["sort_order", "id"]


class Additive(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="additives")
    name = models.CharField(max_length=160)
    code = models.CharField(max_length=40, blank=True)
    is_present = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]


class Allergen(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="allergens")
    name = models.CharField(max_length=80)
    detail = models.CharField(max_length=160, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]


class RelatedProduct(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="related_links")
    related = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="related_from")
    kind = models.CharField(max_length=20, choices=RelatedKind.choices, default=RelatedKind.RELATED)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["product", "related"], name="unique_related_product"),
        ]


class LabReport(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="lab_reports")
    lab_name = models.CharField(max_length=200)
    accreditation = models.CharField(max_length=200, blank=True)
    tested_on = models.DateField()
    summary = models.CharField(max_length=300, blank=True)
    pdf = models.FileField(
        upload_to="products/reports/",
        storage=private_media_storage,
        validators=[validate_report_file],
    )
    is_current = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-tested_on", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["product"],
                condition=models.Q(is_current=True),
                name="one_current_lab_report_per_product",
            )
        ]


class LabReportSection(models.Model):
    class Key(models.TextChoices):
        HEAVY_METALS = "heavy_metals", "Heavy metals"
        MYCOTOXINS = "mycotoxins", "Mycotoxins"
        MICROBIOLOGY = "microbiology", "Microbiology"
        PESTICIDES = "pesticides", "Pesticides"
        LABEL_CLAIMS = "label_claims", "Label claims"

    report = models.ForeignKey(LabReport, on_delete=models.CASCADE, related_name="sections")
    key = models.CharField(max_length=40, choices=Key.choices)
    title = models.CharField(max_length=120)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]


class LabReportResult(models.Model):
    section = models.ForeignKey(LabReportSection, on_delete=models.CASCADE, related_name="results")
    analyte = models.CharField(max_length=160)
    detected_value = models.CharField(max_length=80)
    unit = models.CharField(max_length=40, blank=True)
    limit_value = models.CharField(max_length=80, blank=True)
    passed = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]


class StockMovement(models.Model):
    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, related_name="movements")
    kind = models.CharField(max_length=20, choices=StockMovementKind.choices)
    delta = models.IntegerField()
    on_hand_after = models.PositiveIntegerField()
    order_id = models.PositiveIntegerField(null=True, blank=True)
    actor = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
