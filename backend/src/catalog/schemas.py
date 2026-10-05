from pathlib import Path

from catalog.writer import serialize_label, serialize_related, serialize_variant
from django.conf import settings

from ninja import Schema


class CategoryOut(Schema):
    id: int
    name: str
    slug: str
    parent_id: int | None
    sort_order: int


class ImageOut(Schema):
    id: int
    url: str
    alt: str
    role: str
    sort_order: int
    original_name: str
    byte_size: int
    created_at: str | None


class VariantOut(Schema):
    id: int
    sku: str
    title: str
    price: str
    compare_at_price: str | None
    unit_count: int
    on_hand: int
    is_active: bool


class NutritionFactOut(Schema):
    name: str
    amount: str
    unit: str
    daily_value: str
    is_highlight: bool
    level: str
    note: str
    group: str
    is_subfact: bool


class NutritionOut(Schema):
    serving_size: str
    serving_basis: str
    headline: str
    facts: list[NutritionFactOut]


class IngredientOut(Schema):
    name: str
    share_percent: str | None
    detail: str
    is_flagged: bool


class AllergenOut(Schema):
    name: str
    detail: str


class LabelChecksOut(Schema):
    banned_found: int
    hidden_sugars_found: int
    shares_printed: bool
    sugar_source: str
    nutritionist_note: str
    lab_passed: bool
    lab_passed_count: int
    lab_total_count: int


class LabelOut(Schema):
    serving_size: str
    serving_basis: str
    headline: str
    note: str
    guidance: str
    nutritionist_note: str
    hidden_sugars_found: int
    banned_ingredients_found: int
    shares_printed: bool
    sugar_source: str
    facts: list[NutritionFactOut]
    ingredients: list[IngredientOut]
    allergens: list[AllergenOut]
    checks: LabelChecksOut


class AdditiveOut(Schema):
    name: str
    code: str
    is_present: bool


class RelatedProductOut(Schema):
    id: int
    title: str
    slug: str
    kind: str


class ProductListOut(Schema):
    id: int
    title: str
    slug: str
    category: CategoryOut
    primary_image: ImageOut | None
    from_price: str | None
    has_passed_report: bool
    default_variant: VariantOut | None = None


class ProductDetailOut(Schema):
    id: int
    title: str
    slug: str
    description: str
    category: CategoryOut
    images: list[ImageOut]
    variants: list[VariantOut]
    nutrition: NutritionOut | None
    ingredients: list[IngredientOut]
    additives: list[AdditiveOut]
    related: list[RelatedProductOut]
    label: LabelOut | None
    has_passed_report: bool


class LabResultOut(Schema):
    analyte: str
    detected_value: str
    unit: str
    limit_value: str
    passed: bool


class LabSectionOut(Schema):
    key: str
    title: str
    results: list[LabResultOut]


class LabReportOut(Schema):
    lab_name: str
    accreditation: str
    tested_on: str
    summary: str
    passed: bool
    sections: list[LabSectionOut]


def image_url(image) -> str:
    if not image.file:
        return ""
    name = str(image.file.name or "").replace("\\", "/")
    local = Path(settings.MEDIA_ROOT) / name
    if name and local.is_file():
        return f"{settings.PUBLIC_API_ORIGIN.rstrip('/')}/{settings.MEDIA_URL.strip('/')}/{name.lstrip('/')}"
    url = image.file.url or ""
    if url.startswith("//"):
        return f"https:{url}"
    if url.startswith("http://") or url.startswith("https://"):
        return url
    origin = settings.PUBLIC_API_ORIGIN.rstrip("/")
    return f"{origin}/{url.lstrip('/')}"


def serialize_category(category) -> dict:
    return {
        "id": category.id,
        "name": category.name,
        "slug": category.slug,
        "parent_id": category.parent_id,
        "sort_order": category.sort_order,
    }


def serialize_image(image, *, position: int | None = None) -> dict:
    is_first = position == 0 if position is not None else False
    name = getattr(image, "original_name", "") or ""
    if not name and getattr(image, "file", None):
        name = image.file.name.rsplit("/", 1)[-1]
    created = getattr(image, "created_at", None)
    return {
        "id": image.id,
        "url": image_url(image),
        "alt": image.alt,
        "role": "primary" if is_first else "secondary",
        "sort_order": position if position is not None else image.sort_order,
        "original_name": name,
        "byte_size": int(getattr(image, "byte_size", 0) or 0),
        "created_at": created.isoformat() if created else None,
    }
