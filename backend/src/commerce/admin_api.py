"""Staff-facing admin API controllers."""

from pathlib import Path
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Count, Max, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.text import slugify
from ninja import File, Form, Query, Schema, UploadedFile
from ninja_extra import ControllerBase, api_controller, route, status
from ninja_extra.exceptions import NotFound, ValidationError
from accounts.auth import SessionJWTAuth
from accounts.staff import ROLE_ADMIN, ROLE_MEMBER, STAFF_ROLES, admin_queryset, is_admin, role_of, serialize_staff
from pydantic import Field, field_validator, model_validator

from catalog.images import apply_image_order, make_image_first, sync_image_order
from catalog.models import Category, Product, ProductImage, ProductStatus, ProductVariant
from catalog.schemas import serialize_image
from catalog.stock import StockService
from catalog.writer import CatalogWriteError, ProductWriter, serialize_label, serialize_related, serialize_variant
from commerce.models import (
    CommerceSettings,
    DeliveryPostalCode,
    DeliveryWindow,
    Discount,
    Order,
    OrderStatus,
    normalize_postal_code,
)
from commerce.orders import serialize_order
from core.money import money, money_str
from core.pagination import PageQuery, paginate_queryset
from core.permissions import IsAdminStaff, IsStaff, authenticated_user
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


class PostalCodePatchIn(Schema):
    code: str | None = Field(default=None, max_length=16)
    is_active: bool | None = None


class MemberIn(Schema):
    email: str = Field(min_length=3, max_length=254)
    first_name: str = Field(default="", max_length=150)
    last_name: str = Field(default="", max_length=150)
    password: str = Field(default="", max_length=128)
    role: str = Field(default=ROLE_MEMBER)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        role = value.strip().lower()
        if role not in STAFF_ROLES:
            raise ValueError("Role must be admin or member.")
        return role


class MemberPatchIn(Schema):
    role: str | None = None
    is_active: bool | None = None
    first_name: str | None = Field(default=None, max_length=150)
    last_name: str | None = Field(default=None, max_length=150)

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str | None) -> str | None:
        if value is None:
            return value
        role = value.strip().lower()
        if role not in STAFF_ROLES:
            raise ValueError("Role must be admin or member.")
        return role


class PricingSettingsIn(Schema):
    delivery_fee: Decimal = Field(ge=0)
    free_delivery_minimum: Decimal = Field(ge=0)


class DiscountIn(Schema):
    name: str
    kind: str
    value: Decimal = Field(gt=0)
    code: str | None = None
    scope: str = "all"
    product_id: int | None = None
    variant_id: int | None = None
    category_id: int | None = None
    starts_at: str | None = None
    ends_at: str | None = None
    is_active: bool = True

    @field_validator("kind")
    @classmethod
    def validate_kind(cls, value: str) -> str:
        if value not in {Discount.Kind.PERCENT, Discount.Kind.FIXED}:
            raise ValueError("Invalid discount kind.")
        return value

    @field_validator("scope")
    @classmethod
    def validate_scope(cls, value: str) -> str:
        if value not in {
            Discount.Scope.ALL,
            Discount.Scope.PRODUCT,
            Discount.Scope.VARIANT,
            Discount.Scope.CATEGORY,
        }:
            raise ValueError("Invalid discount scope.")
        return value


class DiscountPatchIn(Schema):
    name: str | None = None
    kind: str | None = None
    value: Decimal | None = Field(default=None, gt=0)
    code: str | None = None
    scope: str | None = None
    product_id: int | None = None
    variant_id: int | None = None
    category_id: int | None = None
    starts_at: str | None = None
    ends_at: str | None = None
    is_active: bool | None = None

    @field_validator("kind")
    @classmethod
    def validate_kind(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if value not in {Discount.Kind.PERCENT, Discount.Kind.FIXED}:
            raise ValueError("Invalid discount kind.")
        return value

    @field_validator("scope")
    @classmethod
    def validate_scope(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if value not in {
            Discount.Scope.ALL,
            Discount.Scope.PRODUCT,
            Discount.Scope.VARIANT,
            Discount.Scope.CATEGORY,
        }:
            raise ValueError("Invalid discount scope.")
        return value


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


def _parse_optional_datetime(value: str | None):
    if value is None:
        return None
    raw = value.strip()
    if not raw:
        return None
    parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    if timezone.is_naive(parsed):
        return timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def _serialize_pricing_settings(row: CommerceSettings) -> dict:
    return {
        "delivery_fee": money_str(row.delivery_fee),
        "free_delivery_minimum": money_str(row.free_delivery_minimum),
    }


def _serialize_discount(row: Discount) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "kind": row.kind,
        "value": money_str(row.value),
        "code": row.code or "",
        "scope": row.scope,
        "product_id": row.product_id,
        "product_title": row.product.title if row.product_id else "",
        "variant_id": row.variant_id,
        "variant_title": row.variant.title if row.variant_id else "",
        "category_id": row.category_id,
        "category_name": row.category.name if row.category_id else "",
        "starts_at": row.starts_at.isoformat() if row.starts_at else "",
        "ends_at": row.ends_at.isoformat() if row.ends_at else "",
        "is_active": row.is_active,
    }


def _apply_discount_scope(row: Discount, payload) -> None:
    scope = payload.scope if payload.scope is not None else row.scope
    if scope == Discount.Scope.ALL:
        row.product_id = None
        row.variant_id = None
        row.category_id = None
        return
    if scope == Discount.Scope.PRODUCT:
        product_id = payload.product_id if payload.product_id is not None else row.product_id
        if not product_id or not Product.objects.filter(pk=product_id).exists():
            raise ValidationError({"product_id": "Product is required for product discounts."})
        row.product_id = product_id
        row.variant_id = None
        row.category_id = None
        return
    if scope == Discount.Scope.VARIANT:
        variant_id = payload.variant_id if payload.variant_id is not None else row.variant_id
        variant = ProductVariant.objects.filter(pk=variant_id).select_related("product").first()
        if variant is None:
            raise ValidationError({"variant_id": "Variant is required for variant discounts."})
        row.variant_id = variant.id
        row.product_id = variant.product_id
        row.category_id = None
        return
    category_id = payload.category_id if payload.category_id is not None else row.category_id
    if not category_id or not Category.objects.filter(pk=category_id).exists():
        raise ValidationError({"category_id": "Category is required for category discounts."})
    row.category_id = category_id
    row.product_id = None
    row.variant_id = None


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
    auth=SessionJWTAuth(),
    permissions=[IsAdminStaff()],
    use_unique_op_id=False,
)
class AdminController(ControllerBase):
    @route.get("/me", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Current staff profile", permissions=[IsStaff()])
    def me(self):
        return success("Staff profile retrieved.", serialize_staff(authenticated_user(self.context.request)))

    @route.get("/members", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="List staff members")
    def list_members(self, query: Query[PageQuery]):
        User = get_user_model()
        qs = User.objects.filter(is_staff=True).order_by("email")
        page = paginate_queryset(qs, page=query.page, page_size=query.page_size)
        page["results"] = [serialize_staff(user) for user in page["results"]]
        return success("Members retrieved.", page)

    @route.post("/members", response={201: SuccessResponse, **_ERROR_RESPONSES}, summary="Add a staff member")
    def create_member(self, payload: MemberIn):
        User = get_user_model()
        user = User.objects.filter(email=payload.email).first()
        if user is None:
            if not payload.password:
                raise ValidationError({"password": "A password is required for a new member."})
            try:
                validate_password(payload.password)
            except DjangoValidationError as exc:
                raise ValidationError({"password": " ".join(exc.messages)}) from exc
            user = User.objects.create_user(
                email=payload.email,
                password=payload.password,
                first_name=payload.first_name.strip(),
                last_name=payload.last_name.strip(),
                is_staff=True,
                staff_role=payload.role,
                email_verified_at=timezone.now(),
            )
        else:
            if payload.password:
                try:
                    validate_password(payload.password, user=user)
                except DjangoValidationError as exc:
                    raise ValidationError({"password": " ".join(exc.messages)}) from exc
                user.set_password(payload.password)
            if payload.first_name.strip():
                user.first_name = payload.first_name.strip()
            if payload.last_name.strip():
                user.last_name = payload.last_name.strip()
            user.is_staff = True
            user.is_active = True
            user.staff_role = payload.role
            if user.email_verified_at is None:
                user.email_verified_at = timezone.now()
            user.save()
        return status.HTTP_201_CREATED, success("Member saved.", serialize_staff(user))

    @route.patch("/members/{user_id}", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Update a staff member")
    def update_member(self, user_id: int, payload: MemberPatchIn):
        User = get_user_model()
        user = User.objects.filter(pk=user_id, is_staff=True).first()
        if user is None:
            raise NotFound("Member not found.")
        actor = self.context.request.user
        next_role = payload.role if payload.role is not None else role_of(user)
        next_active = user.is_active if payload.is_active is None else payload.is_active
        losing_admin = is_admin(user) and (next_role != ROLE_ADMIN or not next_active)
        if losing_admin and admin_queryset().exclude(pk=user.pk).count() < 1:
            raise ValidationError({"role": "Keep at least one admin."})
        if payload.role is not None:
            user.staff_role = payload.role
            if payload.role == ROLE_ADMIN:
                pass
            elif user.pk == actor.pk and is_admin(actor):
                raise ValidationError({"role": "Ask another admin to change your role."})
        if payload.is_active is not None:
            if user.pk == actor.pk and payload.is_active is False:
                raise ValidationError({"is_active": "You cannot deactivate your own account."})
            user.is_active = payload.is_active
        if payload.first_name is not None:
            user.first_name = payload.first_name.strip()
        if payload.last_name is not None:
            user.last_name = payload.last_name.strip()
        user.save()
        return success("Member updated.", serialize_staff(user))

    @route.delete("/members/{user_id}", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Remove staff access")
    def delete_member(self, user_id: int):
        User = get_user_model()
        user = User.objects.filter(pk=user_id, is_staff=True).first()
        if user is None:
            raise NotFound("Member not found.")
        if user.pk == self.context.request.user.pk:
            raise ValidationError({"member": "You cannot remove your own access."})
        if is_admin(user) and admin_queryset().exclude(pk=user.pk).count() < 1:
            raise ValidationError({"member": "Keep at least one admin."})
        user.is_staff = False
        user.staff_role = ""
        user.save(update_fields=["is_staff", "staff_role"])
        return success("Member removed.", {"deleted": True})

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

    @route.get("/orders", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="List all orders", permissions=[IsStaff()])
    def list_orders(self, query: Query[PageQuery], status_filter: str | None = None):
        qs = Order.objects.select_related("user").prefetch_related("lines").order_by("-created_at")
        if status_filter:
            qs = qs.filter(status=status_filter)
        page = paginate_queryset(qs, page=query.page, page_size=query.page_size)
        page["results"] = [
            {**serialize_order(order), "user_email": order.user.email} for order in page["results"]
        ]
        return success("Orders retrieved.", page)

    @route.get("/orders/{number}", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Get an order", permissions=[IsStaff()])
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

    @route.patch(
        "/delivery/postal-codes/{code_id}",
        response={200: SuccessResponse, **_ERROR_RESPONSES},
        summary="Update postal code",
    )
    def update_postal_code(self, code_id: int, payload: PostalCodePatchIn):
        row = DeliveryPostalCode.objects.filter(pk=code_id).first()
        if row is None:
            raise NotFound("Postal code not found.")
        if payload.code is not None:
            code = normalize_postal_code(payload.code)
            if not code:
                raise ValidationError({"code": "Postal code is required."})
            clash = DeliveryPostalCode.objects.filter(code=code).exclude(pk=row.pk).exists()
            if clash:
                raise ValidationError({"code": "That postal code already exists."})
            row.code = code
        if payload.is_active is not None:
            row.is_active = payload.is_active
        row.save()
        return success("Postal code updated.", {"id": row.id, "code": row.code, "is_active": row.is_active})

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

    @route.get("/pricing", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Get pricing settings")
    def get_pricing(self):
        return success("Pricing settings retrieved.", _serialize_pricing_settings(CommerceSettings.load()))

    @route.patch("/pricing", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Update pricing settings")
    def update_pricing(self, payload: PricingSettingsIn):
        row = CommerceSettings.load()
        row.delivery_fee = money(payload.delivery_fee)
        row.free_delivery_minimum = money(payload.free_delivery_minimum)
        row.save(update_fields=["delivery_fee", "free_delivery_minimum"])
        return success("Pricing settings updated.", _serialize_pricing_settings(row))

    @route.get("/discounts", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="List discounts")
    def list_discounts(self):
        rows = [
            _serialize_discount(row)
            for row in Discount.objects.select_related("product", "variant", "category").order_by("-id")
        ]
        return success("Discounts retrieved.", rows)

    @route.post("/discounts", response={201: SuccessResponse, **_ERROR_RESPONSES}, summary="Create discount")
    def create_discount(self, payload: DiscountIn):
        code = (payload.code or "").strip() or None
        if code and Discount.objects.filter(code__iexact=code).exists():
            raise ValidationError({"code": "That discount code already exists."})
        row = Discount(
            name=payload.name.strip(),
            kind=payload.kind,
            value=money(payload.value),
            code=code,
            scope=payload.scope,
            starts_at=_parse_optional_datetime(payload.starts_at),
            ends_at=_parse_optional_datetime(payload.ends_at),
            is_active=payload.is_active,
        )
        _apply_discount_scope(row, payload)
        row.save()
        row.refresh_from_db()
        return status.HTTP_201_CREATED, success("Discount created.", _serialize_discount(row))

    @route.patch("/discounts/{discount_id}", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Update discount")
    def update_discount(self, discount_id: int, payload: DiscountPatchIn):
        row = Discount.objects.filter(pk=discount_id).select_related("product", "variant", "category").first()
        if row is None:
            raise NotFound("Discount not found.")
        if payload.name is not None:
            row.name = payload.name.strip()
        if payload.kind is not None:
            row.kind = payload.kind
        if payload.value is not None:
            row.value = money(payload.value)
        if payload.code is not None:
            code = payload.code.strip() or None
            if code and Discount.objects.filter(code__iexact=code).exclude(pk=row.pk).exists():
                raise ValidationError({"code": "That discount code already exists."})
            row.code = code
        if payload.scope is not None:
            row.scope = payload.scope
        if payload.starts_at is not None:
            row.starts_at = _parse_optional_datetime(payload.starts_at)
        if payload.ends_at is not None:
            row.ends_at = _parse_optional_datetime(payload.ends_at)
        if payload.is_active is not None:
            row.is_active = payload.is_active
        _apply_discount_scope(row, payload)
        row.save()
        return success("Discount updated.", _serialize_discount(row))

    @route.delete("/discounts/{discount_id}", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Delete discount")
    def delete_discount(self, discount_id: int):
        deleted, _ = Discount.objects.filter(pk=discount_id).delete()
        if not deleted:
            raise NotFound("Discount not found.")
        return success("Discount deleted.", {"deleted": True})
