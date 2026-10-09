"""Apply catalog product graphs: variants (pack offers), flavor links, and label data."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import ObjectDoesNotExist

from catalog.models import (
    Allergen,
    Ingredient,
    LabReport,
    NutritionFact,
    NutritionProfile,
    Product,
    ProductStatus,
    ProductVariant,
    RelatedKind,
    RelatedProduct,
    TrafficLevel,
)
from catalog.queries import current_report, report_has_passed, report_score
from catalog.stock import StockService
from core.money import money

LEVELS = {choice for choice, _ in TrafficLevel.choices}
KINDS = {choice for choice, _ in RelatedKind.choices}


class CatalogWriteError(ValueError):
    pass


class ProductWriter:
    def __init__(self, stock: StockService | None = None, actor=None):
        self._stock = stock or StockService()
        self._actor = actor

    def upsert_variants(self, product: Product, rows: list[dict[str, Any]]) -> None:
        if not rows:
            raise CatalogWriteError(f"Product '{product.slug}' needs at least one offer/variant.")
        seen = set()
        for row in rows:
            sku = str(row.get("sku") or "").strip()
            if not sku:
                raise CatalogWriteError(f"Product '{product.slug}' has an offer without a SKU.")
            if sku in seen:
                raise CatalogWriteError(f"Duplicate SKU '{sku}' on product '{product.slug}'.")
            seen.add(sku)
            try:
                price = money(Decimal(str(row.get("price"))))
            except (InvalidOperation, TypeError) as exc:
                raise CatalogWriteError(f"Invalid price for SKU '{sku}'.") from exc
            compare = row.get("compare_at_price")
            unit_count = int(row.get("unit_count") or 1)
            if unit_count < 1:
                raise CatalogWriteError(f"unit_count must be at least 1 for SKU '{sku}'.")
            max_order = row.get("max_order")
            if max_order in (None, ""):
                max_order_value = None
            else:
                max_order_value = int(max_order)
                if max_order_value < 1:
                    raise CatalogWriteError(f"max_order must be at least 1 for SKU '{sku}'.")
            variant, created = ProductVariant.objects.update_or_create(
                sku=sku,
                defaults={
                    "product": product,
                    "title": str(row.get("title") or "Default").strip()[:120],
                    "price": price,
                    "compare_at_price": money(Decimal(str(compare))) if compare not in (None, "") else None,
                    "unit_count": unit_count,
                    "max_order": max_order_value,
                    "is_active": bool(row.get("is_active", True)),
                },
            )
            if not created and variant.product_id != product.id:
                raise CatalogWriteError(f"SKU '{sku}' already belongs to another product.")
            on_hand = int(row.get("on_hand") or 0)
            if created or variant.on_hand != on_hand:
                self._stock.set_on_hand(variant=variant, quantity=on_hand, actor=self._actor)

    def replace_label(self, product: Product, row: dict[str, Any] | None) -> None:
        NutritionProfile.objects.filter(product=product).delete()
        Ingredient.objects.filter(product=product).delete()
        Allergen.objects.filter(product=product).delete()
        if not row:
            return
        profile = NutritionProfile.objects.create(
            product=product,
            serving_size=str(row.get("serving_size") or "")[:80],
            serving_basis=str(row.get("serving_basis") or "")[:80],
            headline=str(row.get("headline") or "")[:200],
            note=str(row.get("note") or "")[:400],
            guidance=str(row.get("guidance") or "")[:400],
            nutritionist_note=str(row.get("nutritionist_note") or "")[:400],
            hidden_sugars_found=int(row.get("hidden_sugars_found") or 0),
            banned_ingredients_found=int(row.get("banned_ingredients_found") or 0),
            shares_printed=bool(row.get("shares_printed", True)),
            sugar_source=str(row.get("sugar_source") or "")[:200],
        )
        for index, fact in enumerate(row.get("facts") or []):
            name = str(fact.get("name") or "").strip()
            if not name:
                continue
            level = str(fact.get("level") or "").strip()
            if level and level not in LEVELS:
                raise CatalogWriteError(f"Invalid traffic level '{level}' on {name}.")
            NutritionFact.objects.create(
                profile=profile,
                name=name[:80],
                amount=str(fact.get("amount") or "")[:40],
                unit=str(fact.get("unit") or "")[:24],
                daily_value=str(fact.get("daily_value") or "")[:24],
                is_highlight=bool(fact.get("is_highlight", False)),
                level=level,
                note=str(fact.get("note") or "")[:200],
                group=str(fact.get("group") or "")[:80],
                is_subfact=bool(fact.get("is_subfact", False)),
                sort_order=index,
            )
        for index, ingredient in enumerate(row.get("ingredients") or []):
            name = str(ingredient.get("name") or "").strip()
            if not name:
                continue
            share = ingredient.get("share_percent")
            Ingredient.objects.create(
                product=product,
                name=name[:160],
                share_percent=Decimal(str(share)) if share not in (None, "") else None,
                detail=str(ingredient.get("detail") or "")[:200],
                is_flagged=bool(ingredient.get("is_flagged", False)),
                sort_order=index,
            )
        for index, allergen in enumerate(row.get("allergens") or []):
            name = str(allergen.get("name") or "").strip()
            if not name:
                continue
            Allergen.objects.create(
                product=product,
                name=name[:80],
                detail=str(allergen.get("detail") or "")[:160],
                sort_order=index,
            )

    def replace_related(self, product: Product, slugs: list[str], *, kind: str = RelatedKind.FLAVOR) -> None:
        if kind not in KINDS:
            raise CatalogWriteError(f"Invalid related kind '{kind}'.")
        RelatedProduct.objects.filter(product=product, kind=kind).delete()
        for index, slug in enumerate(slugs or []):
            slug = str(slug or "").strip()
            if not slug or slug == product.slug:
                continue
            related = Product.objects.filter(slug=slug).first()
            if related is None:
                raise CatalogWriteError(f"Related product '{slug}' was not found.")
            RelatedProduct.objects.update_or_create(
                product=product,
                related=related,
                defaults={"kind": kind, "sort_order": index},
            )
            if kind == RelatedKind.FLAVOR:
                RelatedProduct.objects.get_or_create(
                    product=related,
                    related=product,
                    defaults={"kind": kind, "sort_order": 0},
                )


def serialize_variant(variant: ProductVariant) -> dict:
    from core.money import money_str

    return {
        "id": variant.id,
        "sku": variant.sku,
        "title": variant.title,
        "price": money_str(variant.price),
        "compare_at_price": money_str(variant.compare_at_price) if variant.compare_at_price is not None else None,
        "unit_count": variant.unit_count,
        "max_order": variant.max_order,
        "on_hand": variant.on_hand,
        "is_active": variant.is_active,
    }


def serialize_label(product: Product, *, report: LabReport | None = None) -> dict | None:
    try:
        nutrition = product.nutrition
    except ObjectDoesNotExist:
        nutrition = None
    ingredients = list(product.ingredients.all())
    allergens = list(product.allergens.all())
    if report is None:
        report = current_report(product)
    passed, total = report_score(report)
    if nutrition is None and not ingredients and not allergens and report is None:
        return None
    facts = []
    if nutrition is not None:
        fact_rows = list(nutrition.facts.all())
        facts = [
            {
                "name": fact.name,
                "amount": fact.amount,
                "unit": fact.unit,
                "daily_value": fact.daily_value,
                "is_highlight": fact.is_highlight,
                "level": fact.level,
                "note": fact.note,
                "group": fact.group,
                "is_subfact": fact.is_subfact,
            }
            for fact in fact_rows
        ]
    return {
        "serving_size": getattr(nutrition, "serving_size", "") or "",
        "serving_basis": getattr(nutrition, "serving_basis", "") or "",
        "headline": getattr(nutrition, "headline", "") or "",
        "note": getattr(nutrition, "note", "") or "",
        "guidance": getattr(nutrition, "guidance", "") or "",
        "nutritionist_note": getattr(nutrition, "nutritionist_note", "") or "",
        "hidden_sugars_found": getattr(nutrition, "hidden_sugars_found", 0) or 0,
        "banned_ingredients_found": getattr(nutrition, "banned_ingredients_found", 0) or 0,
        "shares_printed": bool(getattr(nutrition, "shares_printed", True)),
        "sugar_source": getattr(nutrition, "sugar_source", "") or "",
        "facts": facts,
        "ingredients": [
            {
                "name": row.name,
                "share_percent": format(row.share_percent, "f") if row.share_percent is not None else None,
                "detail": row.detail,
                "is_flagged": row.is_flagged,
            }
            for row in ingredients
        ],
        "allergens": [{"name": row.name, "detail": row.detail} for row in allergens],
        "checks": {
            "banned_found": getattr(nutrition, "banned_ingredients_found", 0) or 0,
            "hidden_sugars_found": getattr(nutrition, "hidden_sugars_found", 0) or 0,
            "shares_printed": bool(getattr(nutrition, "shares_printed", True)),
            "sugar_source": getattr(nutrition, "sugar_source", "") or "",
            "nutritionist_note": getattr(nutrition, "nutritionist_note", "") or "",
            "lab_passed": report_has_passed(report),
            "lab_passed_count": passed,
            "lab_total_count": total,
        },
    }


def serialize_related(product: Product, *, active_only: bool = True) -> list[dict]:
    from catalog.schemas import image_url

    rows = []
    for link in product.related_links.all():
        related = link.related
        if active_only and related.status != ProductStatus.ACTIVE:
            continue
        images = list(related.images.all())
        primary = images[0] if images else None
        rows.append(
            {
                "id": related.id,
                "title": related.title,
                "slug": related.slug,
                "kind": link.kind,
                "image_url": image_url(primary) if primary else None,
            }
        )
    return rows
