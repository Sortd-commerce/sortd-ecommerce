"""Staff-facing admin API controllers."""

from pathlib import Path
from datetime import time, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Count, Max, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.text import slugify
from ninja import File, Form, Query, Schema, UploadedFile
from ninja_extra import ControllerBase, api_controller, route, status
from ninja_extra.exceptions import NotFound, ValidationError
from ninja_jwt.authentication import JWTAuth
from pydantic import Field, field_validator, model_validator

from catalog.images import apply_image_order, make_image_first, sync_image_order
from catalog.models import Category, Product, ProductImage, ProductStatus, ProductVariant
from catalog.schemas import serialize_image
from catalog.stock import StockService
from catalog.writer import CatalogWriteError, ProductWriter, serialize_label, serialize_related, serialize_variant
from commerce.models import (
    DeliveryPostalCode,
    DeliveryWindow,
    Order,
    OrderStatus,
    normalize_postal_code,
)
from commerce.orders import serialize_order
from core.money import money, money_str
from core.pagination import PageQuery, paginate_queryset
from core.permissions import IsStaff
from core.responses import ErrorResponse, SuccessResponse, success

_ERROR_RESPONSES = {
    400: ErrorResponse,
    401: ErrorResponse,
    403: ErrorResponse,
    404: ErrorResponse,
    422: ErrorResponse,
}


class VariantOfferIn(Schema):
    sku: str = Field(min_length=1, max_length=64)
    title: str = Field(default="Default", max_length=120)
    price: Decimal
    compare_at_price: Decimal | None = None
    unit_count: int = Field(default=1, ge=1)
    on_hand: int = Field(default=0, ge=0)
    is_active: bool = True


class LabelFactIn(Schema):
    name: str
    amount: str = ""
    unit: str = ""
    daily_value: str = ""
    is_highlight: bool = False
    level: str = ""
    note: str = ""
    group: str = ""
    is_subfact: bool = False


class LabelIngredientIn(Schema):
    name: str
    share_percent: Decimal | None = None
    detail: str = ""
    is_flagged: bool = False


class LabelAllergenIn(Schema):
    name: str
    detail: str = ""


class LabelIn(Schema):
    serving_size: str = ""
    serving_basis: str = ""
    headline: str = ""
    note: str = ""
    guidance: str = ""
    nutritionist_note: str = ""
    hidden_sugars_found: int = 0
    banned_ingredients_found: int = 0
    shares_printed: bool = True
    sugar_source: str = ""
    facts: list[LabelFactIn] = Field(default_factory=list)
    ingredients: list[LabelIngredientIn] = Field(default_factory=list)
    allergens: list[LabelAllergenIn] = Field(default_factory=list)


class ProductCreateIn(Schema):
    title: str = Field(min_length=1, max_length=200)
    slug: str | None = None
    description: str = ""
    category_id: int
    status: str = ProductStatus.DRAFT
    variant_sku: str | None = Field(default=None, max_length=64)
    variant_title: str = Field(default="Default", max_length=120)
    price: Decimal | None = None
    on_hand: int = Field(default=0, ge=0)
    unit_count: int = Field(default=1, ge=1)
    variants: list[VariantOfferIn] = Field(default_factory=list)
    related_slugs: list[str] = Field(default_factory=list)
    related_kind: str = "flavor"
    label: LabelIn | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        if value not in ProductStatus.values:
            raise ValueError("Invalid product status.")
        return value

    @model_validator(mode="after")
    def require_an_offer(self):
        if self.variants:
            return self
        if not self.variant_sku or self.price is None:
            raise ValueError("Provide variants, or variant_sku and price.")
        return self


class ProductUpdateIn(Schema):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    category_id: int | None = None
    status: str | None = None
    related_slugs: list[str] | None = None
    related_kind: str = "flavor"
    label: LabelIn | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if value not in ProductStatus.values:
            raise ValueError("Invalid product status.")
        return value


class ImageOrderIn(Schema):
    image_ids: list[int] = Field(min_length=1)


class VariantStockIn(Schema):
    on_hand: int = Field(ge=0)


class VariantUpdateIn(Schema):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    price: Decimal | None = None
    compare_at_price: Decimal | None = None
    unit_count: int | None = Field(default=None, ge=1)
    is_active: bool | None = None


class OrderStatusIn(Schema):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        allowed = {
            OrderStatus.CONFIRMED,
            OrderStatus.OUT_FOR_DELIVERY,
            OrderStatus.DELIVERED,
            OrderStatus.CANCELLED,
        }
        if value not in allowed:
            raise ValueError("Invalid order status transition.")
        return value


class WindowIn(Schema):
    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    capacity: int = Field(ge=1)
    cutoff_minutes: int = Field(default=60, ge=0)
    is_active: bool = True


class PostalCodeIn(Schema):
    code: str = Field(min_length=1, max_length=16)
    is_active: bool = True


class CategoryIn(Schema):
    name: str = Field(min_length=1, max_length=120)
    slug: str | None = None
    sort_order: int = 0
    is_active: bool = True


def _product_qs():
    return Product.objects.select_related("category", "nutrition").prefetch_related(
        "variants",
        "images",
        "ingredients",
        "allergens",
        "nutrition__facts",
        "related_links__related",
        "lab_reports__sections__results",
    )


def _product_admin_row(product: Product) -> dict:
    return {
        "id": product.id,
        "title": product.title,
        "slug": product.slug,
        "description": product.description,
        "status": product.status,
        "category": {"id": product.category_id, "name": product.category.name, "slug": product.category.slug},
        "images": [serialize_image(image, position=index) for index, image in enumerate(product.images.all())],
        "variants": [serialize_variant(variant) for variant in product.variants.all()],
        "related": serialize_related(product, active_only=False),
        "label": serialize_label(product),
        "updated_at": product.updated_at.isoformat(),
    }


def _writer(request) -> ProductWriter:
    return ProductWriter(actor=getattr(request, "user", None))


def _offer_rows(payload: ProductCreateIn) -> list[dict]:
    if payload.variants:
        return [item.model_dump() for item in payload.variants]
    return [
        {
            "sku": payload.variant_sku,
            "title": payload.variant_title,
            "price": payload.price,
            "unit_count": payload.unit_count,
            "on_hand": payload.on_hand,
            "is_active": True,
        }
    ]


@api_controller(
    "/admin",
    tags=["Admin"],
    auth=JWTAuth(),
    permissions=[IsStaff()],
    use_unique_op_id=False,
)
class AdminController(ControllerBase):
    @route.get("/analytics/overview", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Dashboard analytics")
    def analytics(self):
        now = timezone.now()
        since = now - timedelta(days=30)
        orders = Order.objects.exclude(status=OrderStatus.CANCELLED)
        recent = orders.filter(created_at__gte=since)
        by_status = {
            row["status"]: row["c"]
            for row in Order.objects.values("status").annotate(c=Count("id"))
        }
        daily = list(
            recent.annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(orders=Count("id"), revenue=Sum("total"))
            .order_by("day")
        )
        low_stock = list(
            ProductVariant.objects.filter(is_active=True, on_hand__lte=5)
            .select_related("product")
            .order_by("on_hand")[:10]
            .values("id", "sku", "on_hand", "product__title")
        )
        return success(
            "Analytics retrieved.",
            {
                "orders_total": Order.objects.count(),
                "orders_open": Order.objects.filter(
                    status__in=[OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.OUT_FOR_DELIVERY]
                ).count(),
                "revenue_30d": money_str(recent.aggregate(total=Sum("total"))["total"] or Decimal("0")),
                "products_active": Product.objects.filter(status=ProductStatus.ACTIVE).count(),
                "customers": Order.objects.values("user_id").distinct().count(),
                "by_status": by_status,
                "daily": [
                    {
                        "date": row["day"].isoformat() if row["day"] else None,
                        "orders": row["orders"],
                        "revenue": money_str(row["revenue"] or Decimal("0")),
                    }
                    for row in daily
                ],
                "low_stock": [
                    {
                        "variant_id": row["id"],
                        "sku": row["sku"],
                        "on_hand": row["on_hand"],
                        "product_title": row["product__title"],
                    }
                    for row in low_stock
                ],
            },
        )

    @route.get("/orders", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="List all orders")
    def list_orders(self, query: Query[PageQuery], status_filter: str | None = None):
        qs = Order.objects.select_related("user").prefetch_related("lines").order_by("-created_at")
        if status_filter:
            qs = qs.filter(status=status_filter)
        page = paginate_queryset(qs, page=query.page, page_size=query.page_size)
        page["results"] = [
            {**serialize_order(order), "user_email": order.user.email} for order in page["results"]
        ]
        return success("Orders retrieved.", page)

    @route.get("/orders/{number}", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Get an order")
    def get_order(self, number: str):
        order = Order.objects.select_related("user").prefetch_related("lines").filter(number=number).first()
        if order is None:
            raise NotFound("Order not found.")
        return success("Order retrieved.", {**serialize_order(order), "user_email": order.user.email})

    @route.patch("/orders/{number}", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Update order status")
    def update_order(self, number: str, payload: OrderStatusIn):
        order = Order.objects.filter(number=number).first()
        if order is None:
            raise NotFound("Order not found.")
        if order.status == OrderStatus.CANCELLED:
            raise ValidationError({"status": "Cancelled orders cannot be updated."})
        if payload.status == OrderStatus.CANCELLED:
            from commerce.factory import build_order_service

            order = build_order_service().cancel(order.user, number=number)
        else:
            transitions = {
                OrderStatus.PLACED: {OrderStatus.CONFIRMED, OrderStatus.CANCELLED},
                OrderStatus.CONFIRMED: {OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED},
                OrderStatus.OUT_FOR_DELIVERY: {OrderStatus.DELIVERED},
            }
            allowed = transitions.get(order.status, set())
            if payload.status not in allowed:
                raise ValidationError({"status": f"Cannot move from {order.status} to {payload.status}."})
            order.status = payload.status
            order.save(update_fields=["status"])
        return success("Order updated.", serialize_order(order))

    @route.get("/products", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="List products for admin")
    def list_products(self, query: Query[PageQuery], status_filter: str | None = None):
        qs = _product_qs().order_by("-updated_at")
        if status_filter:
            qs = qs.filter(status=status_filter)
        page = paginate_queryset(qs, page=query.page, page_size=query.page_size)
        page["results"] = [_product_admin_row(product) for product in page["results"]]
        return success("Products retrieved.", page)

    @route.post("/products", response={201: SuccessResponse, **_ERROR_RESPONSES}, summary="Create a product")
    def create_product(self, payload: ProductCreateIn):
        category = Category.objects.filter(pk=payload.category_id).first()
        if category is None:
            raise ValidationError({"category_id": "Category not found."})
        slug = (payload.slug or slugify(payload.title)).strip()
        if Product.objects.filter(slug=slug).exists():
            raise ValidationError({"slug": "A product with this slug already exists."})
        writer = _writer(self.context.request)
        offers = _offer_rows(payload)
        skus = [str(row["sku"]).strip() for row in offers]
        if ProductVariant.objects.filter(sku__in=skus).exists():
            raise ValidationError({"sku": "One of the SKUs already exists."})
        try:
            with transaction.atomic():
                product = Product.objects.create(
                    title=payload.title.strip(),
                    slug=slug,
                    description=payload.description,
                    category=category,
                    status=payload.status,
                )
                writer.upsert_variants(product, offers)
                if payload.label is not None:
                    writer.replace_label(product, payload.label.model_dump())
                if payload.related_slugs:
                    writer.replace_related(product, payload.related_slugs, kind=payload.related_kind)
        except CatalogWriteError as exc:
            raise ValidationError({"product": str(exc)}) from exc
        product = _product_qs().get(pk=product.pk)
        return status.HTTP_201_CREATED, success("Product created.", _product_admin_row(product))

    @route.get("/products/{product_id}", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Get product")
    def get_product(self, product_id: int):
        product = _product_qs().filter(pk=product_id).first()
        if product is None:
            raise NotFound("Product not found.")
        return success("Product retrieved.", _product_admin_row(product))

    @route.patch("/products/{product_id}", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Update product")
    def update_product(self, product_id: int, payload: ProductUpdateIn):
        product = _product_qs().filter(pk=product_id).first()
        if product is None:
            raise NotFound("Product not found.")
        fields = []
        if payload.title is not None:
            product.title = payload.title.strip()
            fields.append("title")
        if payload.description is not None:
            product.description = payload.description
            fields.append("description")
        if payload.status is not None:
            product.status = payload.status
            fields.append("status")
        if payload.category_id is not None:
            if not Category.objects.filter(pk=payload.category_id).exists():
                raise ValidationError({"category_id": "Category not found."})
            product.category_id = payload.category_id
            fields.append("category")
        if fields:
            product.save(update_fields=fields + ["updated_at"])
        writer = _writer(self.context.request)
        try:
            if payload.label is not None:
                writer.replace_label(product, payload.label.model_dump())
            if payload.related_slugs is not None:
                writer.replace_related(product, payload.related_slugs, kind=payload.related_kind)
        except CatalogWriteError as exc:
            raise ValidationError({"product": str(exc)}) from exc
        product = _product_qs().get(pk=product.pk)
        return success("Product updated.", _product_admin_row(product))

    @route.post(
        "/products/{product_id}/images",
        response={201: SuccessResponse, **_ERROR_RESPONSES},
        summary="Upload a product image",
    )
    def upload_product_image(
        self,
        product_id: int,
        file: UploadedFile = File(...),
        alt: str = Form(""),
    ):
        product = Product.objects.filter(pk=product_id).first()
        if product is None:
            raise NotFound("Product not found.")
        next_order = (product.images.aggregate(m=Max("sort_order"))["m"] or -1) + 1
        image = ProductImage(
            product=product,
            alt=(alt or "")[:200],
            original_name=Path(getattr(file, "name", "") or "").name[:255],
            byte_size=int(getattr(file, "size", 0) or 0),
            role="secondary",
            sort_order=next_order,
        )
        image.file = file
        try:
            image.full_clean()
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else {"file": list(exc.messages)})
        image.save()
        sync_image_order(product)
        image.refresh_from_db()
        position = next(
            index
            for index, row in enumerate(product.images.order_by("sort_order", "id"))
            if row.pk == image.pk
        )
        return status.HTTP_201_CREATED, success("Image uploaded.", serialize_image(image, position=position))

    @route.patch(
        "/products/{product_id}/images/order",
        response={200: SuccessResponse, **_ERROR_RESPONSES},
        summary="Reorder product images",
    )
    def reorder_product_images(self, product_id: int, payload: ImageOrderIn):
        product = Product.objects.filter(pk=product_id).first()
        if product is None:
            raise NotFound("Product not found.")
        try:
            apply_image_order(product, payload.image_ids)
        except ValueError as exc:
            raise ValidationError({"image_ids": str(exc)}) from exc
        product = _product_qs().get(pk=product.pk)
        return success("Image order updated.", _product_admin_row(product))

    @route.delete(
        "/products/{product_id}/images/{image_id}",
        response={200: SuccessResponse, **_ERROR_RESPONSES},
        summary="Delete a product image",
    )
    def delete_product_image(self, product_id: int, image_id: int):
        image = ProductImage.objects.filter(pk=image_id, product_id=product_id).first()
        if image is None:
            raise NotFound("Image not found.")
        product = image.product
        image.file.delete(save=False)
        image.delete()
        sync_image_order(product)
        return success("Image deleted.", {"id": image_id})

    @route.post(
        "/products/{product_id}/images/{image_id}/first",
        response={200: SuccessResponse, **_ERROR_RESPONSES},
        summary="Make this gallery image first (primary)",
    )
    def make_product_image_first(self, product_id: int, image_id: int):
        product = Product.objects.filter(pk=product_id).first()
        if product is None:
            raise NotFound("Product not found.")
        image = ProductImage.objects.filter(pk=image_id, product_id=product_id).first()
        if image is None:
            raise NotFound("Image not found.")
        make_image_first(product, image)
        product = _product_qs().get(pk=product.pk)
        return success("Primary image updated.", _product_admin_row(product))

    @route.post(
        "/products/{product_id}/variants",
        response={201: SuccessResponse, **_ERROR_RESPONSES},
        summary="Add a pack offer / variant",
    )
    def add_variant(self, product_id: int, payload: VariantOfferIn):
        product = Product.objects.filter(pk=product_id).first()
        if product is None:
            raise NotFound("Product not found.")
        if ProductVariant.objects.filter(sku=payload.sku.strip()).exists():
            raise ValidationError({"sku": "SKU already exists."})
        try:
            _writer(self.context.request).upsert_variants(product, [payload.model_dump()])
        except CatalogWriteError as exc:
            raise ValidationError({"variant": str(exc)}) from exc
        product = _product_qs().get(pk=product.pk)
        return status.HTTP_201_CREATED, success("Offer added.", _product_admin_row(product))

    @route.patch(
        "/variants/{variant_id}",
        response={200: SuccessResponse, **_ERROR_RESPONSES},
        summary="Update a variant",
    )
    def update_variant(self, variant_id: int, payload: VariantUpdateIn):
        variant = ProductVariant.objects.select_related("product").filter(pk=variant_id).first()
        if variant is None:
            raise NotFound("Variant not found.")
        fields = []
        if payload.title is not None:
            variant.title = payload.title.strip()
            fields.append("title")
        if payload.price is not None:
            variant.price = money(payload.price)
            fields.append("price")
        if payload.compare_at_price is not None:
            variant.compare_at_price = money(payload.compare_at_price)
            fields.append("compare_at_price")
        if payload.unit_count is not None:
            variant.unit_count = payload.unit_count
            fields.append("unit_count")
        if payload.is_active is not None:
            variant.is_active = payload.is_active
            fields.append("is_active")
        if fields:
            variant.save(update_fields=fields)
        return success(
            "Variant updated.",
            {
                "id": variant.id,
                "sku": variant.sku,
                "title": variant.title,
                "compare_at_price": money_str(variant.compare_at_price) if variant.compare_at_price is not None else None,
                "unit_count": variant.unit_count,
                "on_hand": variant.on_hand,
                "is_active": variant.is_active,
            },
        )

    @route.post(
        "/variants/{variant_id}/stock",
        response={200: SuccessResponse, **_ERROR_RESPONSES},
        summary="Set variant stock through the ledger",
    )
    def set_stock(self, variant_id: int, payload: VariantStockIn):
        variant = ProductVariant.objects.filter(pk=variant_id).first()
        if variant is None:
            raise NotFound("Variant not found.")
        StockService().set_on_hand(
            variant=variant, quantity=payload.on_hand, actor=self.context.request.user
        )
        variant.refresh_from_db()
        return success("Stock updated.", {"id": variant.id, "sku": variant.sku, "on_hand": variant.on_hand})

    @route.get("/categories", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="List categories")
    def list_categories(self):
        rows = [
            {
                "id": category.id,
                "name": category.name,
                "slug": category.slug,
                "sort_order": category.sort_order,
                "is_active": category.is_active,
            }
            for category in Category.objects.all().order_by("sort_order", "name")
        ]
        return success("Categories retrieved.", rows)

    @route.post("/categories", response={201: SuccessResponse, **_ERROR_RESPONSES}, summary="Create category")
    def create_category(self, payload: CategoryIn):
        slug = (payload.slug or slugify(payload.name)).strip()
        if Category.objects.filter(slug=slug).exists():
            raise ValidationError({"slug": "Category slug already exists."})
        category = Category.objects.create(
            name=payload.name.strip(),
            slug=slug,
            sort_order=payload.sort_order,
            is_active=payload.is_active,
        )
        return status.HTTP_201_CREATED, success(
            "Category created.",
            {
                "id": category.id,
                "name": category.name,
                "slug": category.slug,
                "sort_order": category.sort_order,
                "is_active": category.is_active,
            },
        )

    @route.get("/delivery/windows", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="List delivery windows")
    def list_windows(self):
        rows = [
            {
                "id": window.id,
                "weekday": window.weekday,
                "start_time": window.start_time.isoformat(),
                "end_time": window.end_time.isoformat(),
                "capacity": window.capacity,
                "cutoff_minutes": window.cutoff_minutes,
                "is_active": window.is_active,
            }
            for window in DeliveryWindow.objects.all()
        ]
        return success("Delivery windows retrieved.", rows)

    @route.post("/delivery/windows", response={201: SuccessResponse, **_ERROR_RESPONSES}, summary="Create delivery window")
    def create_window(self, payload: WindowIn):
        if payload.end_time <= payload.start_time:
            raise ValidationError({"end_time": "End time must be after start time."})
        window = DeliveryWindow.objects.create(
            weekday=payload.weekday,
            start_time=payload.start_time,
            end_time=payload.end_time,
            capacity=payload.capacity,
            cutoff_minutes=payload.cutoff_minutes,
            is_active=payload.is_active,
        )
        return status.HTTP_201_CREATED, success(
            "Delivery window created.",
            {
                "id": window.id,
                "weekday": window.weekday,
                "start_time": window.start_time.isoformat(),
                "end_time": window.end_time.isoformat(),
                "capacity": window.capacity,
                "cutoff_minutes": window.cutoff_minutes,
                "is_active": window.is_active,
            },
        )

    @route.patch(
        "/delivery/windows/{window_id}",
        response={200: SuccessResponse, **_ERROR_RESPONSES},
        summary="Update delivery window",
    )
    def update_window(self, window_id: int, payload: WindowIn):
        window = DeliveryWindow.objects.filter(pk=window_id).first()
        if window is None:
            raise NotFound("Delivery window not found.")
        if payload.end_time <= payload.start_time:
            raise ValidationError({"end_time": "End time must be after start time."})
        window.weekday = payload.weekday
        window.start_time = payload.start_time
        window.end_time = payload.end_time
        window.capacity = payload.capacity
        window.cutoff_minutes = payload.cutoff_minutes
        window.is_active = payload.is_active
        window.save()
        return success(
            "Delivery window updated.",
            {
                "id": window.id,
                "weekday": window.weekday,
                "start_time": window.start_time.isoformat(),
                "end_time": window.end_time.isoformat(),
                "capacity": window.capacity,
                "cutoff_minutes": window.cutoff_minutes,
                "is_active": window.is_active,
            },
        )

    @route.delete(
        "/delivery/windows/{window_id}",
        response={200: SuccessResponse, **_ERROR_RESPONSES},
        summary="Delete delivery window",
    )
    def delete_window(self, window_id: int):
        deleted, _ = DeliveryWindow.objects.filter(pk=window_id).delete()
        if not deleted:
            raise NotFound("Delivery window not found.")
        return success("Delivery window deleted.", {"deleted": True})

    @route.get("/delivery/postal-codes", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="List postal codes")
    def list_postal_codes(self):
        rows = [
            {"id": row.id, "code": row.code, "is_active": row.is_active}
            for row in DeliveryPostalCode.objects.all()
        ]
        return success("Postal codes retrieved.", rows)

    @route.post("/delivery/postal-codes", response={201: SuccessResponse, **_ERROR_RESPONSES}, summary="Add postal code")
    def create_postal_code(self, payload: PostalCodeIn):
        code = normalize_postal_code(payload.code)
        if not code:
            raise ValidationError({"code": "Postal code is required."})
        row, created = DeliveryPostalCode.objects.get_or_create(
            code=code, defaults={"is_active": payload.is_active}
        )
        if not created:
            row.is_active = payload.is_active
            row.save(update_fields=["is_active"])
        return status.HTTP_201_CREATED, success(
            "Postal code saved.", {"id": row.id, "code": row.code, "is_active": row.is_active}
        )

    @route.delete(
        "/delivery/postal-codes/{code_id}",
        response={200: SuccessResponse, **_ERROR_RESPONSES},
        summary="Delete postal code",
    )
    def delete_postal_code(self, code_id: int):
        deleted, _ = DeliveryPostalCode.objects.filter(pk=code_id).delete()
        if not deleted:
            raise NotFound("Postal code not found.")
        return success("Postal code deleted.", {"deleted": True})
