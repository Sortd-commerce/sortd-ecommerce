"""Export catalog products to client import workbook row dicts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from catalog.excel_importer import AISLE_TO_CATEGORY, NUTRITION_FIELDS
from catalog.import_columns import IMPORT_COLUMN_KEYS
from catalog.models import Product, ProductStatus, ProductVariant
from catalog.schemas import category_image_url, image_url

CATEGORY_SLUG_TO_AISLE: dict[str, str] = {
    slug: aisle for aisle, (_name, slug, _sort) in AISLE_TO_CATEGORY.items()
}

DB_STATUS_TO_EXCEL: dict[str, str] = {
    ProductStatus.ACTIVE: "Live",
    ProductStatus.DRAFT: "Draft",
    ProductStatus.ARCHIVED: "Paused",
}

FACT_NAME_TO_KEY: dict[str, str] = {name: key for key, (name, _unit, _level) in NUTRITION_FIELDS.items()}


def load_base_rows(path: Path | None) -> dict[str, dict[str, Any]]:
    """Optional JSON map of sortd_sku -> row, used to preserve fields not stored on Product."""
    if path is None or not path.is_file():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        return {}
    rows: dict[str, dict[str, Any]] = {}
    for row in payload:
        sku = str(row.get("sortd_sku") or "").strip().upper()
        if sku:
            rows[sku] = row
    return rows


def _split_title(title: str) -> tuple[str, str]:
    text = (title or "").strip()
    if ", " in text:
        name, variant = text.split(", ", 1)
        return name.strip(), variant.strip()
    return text, ""


def _fact_map(product: Product) -> dict[str, Any]:
    profile = getattr(product, "nutrition", None)
    if profile is None:
        try:
            profile = product.nutrition
        except Exception:
            return {}
    if profile is None:
        return {}
    out: dict[str, Any] = {}
    for fact in profile.facts.all():
        key = FACT_NAME_TO_KEY.get(fact.name.strip())
        if not key:
            continue
        out[key] = fact.amount
        level_key = NUTRITION_FIELDS[key][2]
        if level_key and fact.level:
            out[level_key] = fact.level.capitalize()
    return out


def _ingredient_columns(product: Product) -> dict[str, Any]:
    items = list(product.ingredients.all()[:8])
    out: dict[str, Any] = {}
    for index, ing in enumerate(items, start=1):
        out[f"ing{index}_name"] = ing.name
        if ing.share_percent is not None:
            out[f"ing{index}_pct"] = ing.share_percent
    if items:
        return out
    profile = getattr(product, "nutrition", None)
    note = getattr(profile, "nutritionist_note", "") if profile else ""
    return {}


def _allergen_columns(product: Product) -> dict[str, Any]:
    contains: list[str] = []
    may_contain = ""
    for allergen in product.allergens.all():
        if allergen.name.strip().lower() == "may contain":
            may_contain = allergen.detail or allergen.name
        else:
            contains.append(allergen.name)
    out: dict[str, Any] = {}
    if contains:
        out["allergens"] = ", ".join(contains)
    if may_contain:
        out["may_contain"] = may_contain
    return out


def _image_columns(product: Product) -> dict[str, str]:
    images = list(product.images.all())
    if not images:
        return {}
    urls = [image_url(img) for img in images if image_url(img)]
    if not urls:
        return {}
    return {"main_image": urls[0], "gallery": ", ".join(urls[1:]) if len(urls) > 1 else ""}


def _lab_columns(product: Product) -> dict[str, Any]:
    report = product.lab_reports.filter(is_current=True).first()
    if report is None:
        return {}
    out: dict[str, Any] = {
        "lab_report_name": report.lab_name,
        "lab_report_date": report.tested_on.isoformat(),
        "lab_report_summary": report.summary,
    }
    if report.pdf:
        url = report.pdf.url or ""
        if url and not url.startswith("http"):
            from django.conf import settings

            origin = settings.PUBLIC_API_ORIGIN.rstrip("/")
            out["lab_report_url"] = f"{origin}/{url.lstrip('/')}"
        else:
            out["lab_report_url"] = url
    return out


def _pack_from_variant(variant: ProductVariant) -> dict[str, Any]:
    title = (variant.title or "").strip()
    if title and title.lower() != "default":
        return {"pack_line": title}
    return {}


def product_to_import_row(product: Product, *, base: dict[str, Any] | None = None) -> dict[str, Any]:
    variant = product.variants.first()
    if variant is None:
        raise ValueError(f"Product {product.id} has no variant.")

    row: dict[str, Any] = {key: "" for key in IMPORT_COLUMN_KEYS}
    if base:
        for key in IMPORT_COLUMN_KEYS:
            value = base.get(key)
            if value not in (None, ""):
                row[key] = value

    product_name, flavor = _split_title(product.title)
    aisle = CATEGORY_SLUG_TO_AISLE.get(product.category.slug, "")

    row["sortd_sku"] = variant.sku
    row["status"] = DB_STATUS_TO_EXCEL.get(product.status, "Draft")
    row["product_name"] = product_name
    if flavor:
        row["variant"] = flavor
    row["brand"] = product.brand
    row["aisle"] = aisle
    row["shelf"] = product.shelf
    row["tags"] = product.tags
    row["short_desc"] = product.description

    if variant.price is not None and variant.price > 0:
        row["price"] = variant.price
    elif row.get("price") in (None, ""):
        row["price"] = variant.price
    if variant.compare_at_price is not None:
        row["compare_price"] = variant.compare_at_price
    row["stock"] = variant.on_hand
    if variant.max_order is not None:
        row["max_order"] = variant.max_order
    row.update(_pack_from_variant(variant))

    profile = getattr(product, "nutrition", None)
    if profile is not None:
        row["headline"] = profile.headline
        row["basis"] = profile.serving_basis
        row["serving"] = profile.serving_size
        row["nutrition_note"] = profile.note
        row["how_to_use"] = profile.guidance
        row["ingredient_note"] = profile.nutritionist_note
        row["shares_printed"] = "Yes" if profile.shares_printed else "No"
        row["chk_hidden_result"] = profile.hidden_sugars_found
        row["chk_banned_result"] = profile.banned_ingredients_found

    row.update(_fact_map(product))
    row.update(_ingredient_columns(product))

    full_ingredients = ", ".join(ing.name for ing in product.ingredients.all())
    if full_ingredients:
        row["ingredients_full"] = full_ingredients

    row.update(_allergen_columns(product))
    row.update(_image_columns(product))
    row.update(_lab_columns(product))

    return row


def export_import_rows(
    *,
    base_rows_path: Path | None = None,
    sku_order: list[str] | None = None,
) -> list[dict[str, Any]]:
    base_by_sku = load_base_rows(base_rows_path)
    products = (
        Product.objects.select_related("category", "nutrition")
        .prefetch_related(
            "variants",
            "images",
            "ingredients",
            "allergens",
            "nutrition__facts",
            "lab_reports",
        )
        .order_by("title")
    )

    rows_by_sku: dict[str, dict[str, Any]] = {}
    for product in products:
        variant = product.variants.first()
        if variant is None:
            continue
        sku = variant.sku.upper()
        rows_by_sku[sku] = product_to_import_row(product, base=base_by_sku.get(sku))

    if sku_order:
        ordered = [rows_by_sku[sku] for sku in sku_order if sku in rows_by_sku]
        seen = {sku for sku in sku_order if sku in rows_by_sku}
        for sku, row in sorted(rows_by_sku.items()):
            if sku not in seen:
                ordered.append(row)
        return ordered

    if base_by_sku:
        ordered: list[dict[str, Any]] = []
        seen_skus: set[str] = set()
        for sku in base_by_sku:
            upper = sku.upper()
            if upper in rows_by_sku:
                ordered.append(rows_by_sku[upper])
                seen_skus.add(upper)
        for sku, row in sorted(rows_by_sku.items()):
            if sku not in seen_skus:
                ordered.append(row)
        return ordered

    return [rows_by_sku[sku] for sku in sorted(rows_by_sku)]


def aisle_rows_for_export() -> list[dict[str, str]]:
    from catalog.models import Category

    rows: list[dict[str, str]] = []
    for aisle, (_name, slug, _sort) in AISLE_TO_CATEGORY.items():
        category = Category.objects.filter(slug=slug).first()
        if category is None:
            continue
        url = category_image_url(category)
        rows.append({"aisle": aisle, "image_url": url})
    return rows
