"""Idempotent catalog import from the storefront seed JSON."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.db import transaction
from django.utils.text import slugify

from catalog.models import Additive, Category, Product, ProductStatus
from catalog.stock import StockService
from catalog.writer import CatalogWriteError, ProductWriter


@dataclass(frozen=True)
class CatalogImportResult:
    categories: int
    created: int
    updated: int


class CatalogImportError(ValueError):
    pass


class CatalogImporter:
    def __init__(self, stock: StockService | None = None):
        self._writer = ProductWriter(stock=stock or StockService())

    def import_payload(self, payload: dict[str, Any]) -> CatalogImportResult:
        if not isinstance(payload, dict):
            raise CatalogImportError("Catalog file must be a JSON object.")
        categories = payload.get("categories") or []
        products = payload.get("products") or []
        if not isinstance(categories, list) or not isinstance(products, list):
            raise CatalogImportError("categories and products must be arrays.")
        try:
            with transaction.atomic():
                category_map = self._upsert_categories(categories)
                created = 0
                updated = 0
                for row in products:
                    was_created = self._upsert_product(row, category_map)
                    if was_created:
                        created += 1
                    else:
                        updated += 1
                for row in products:
                    self._apply_related(row)
        except CatalogWriteError as exc:
            raise CatalogImportError(str(exc)) from exc
        return CatalogImportResult(categories=len(category_map), created=created, updated=updated)

    def _upsert_categories(self, rows: list[dict[str, Any]]) -> dict[str, Category]:
        mapping: dict[str, Category] = {}
        for index, row in enumerate(rows):
            name = str(row.get("name") or "").strip()
            if not name:
                raise CatalogImportError(f"Category at index {index} is missing a name.")
            slug = str(row.get("slug") or slugify(name)).strip()
            category, _ = Category.objects.update_or_create(
                slug=slug,
                defaults={
                    "name": name,
                    "sort_order": int(row.get("sort_order") or index),
                    "is_active": bool(row.get("is_active", True)),
                },
            )
            mapping[slug] = category
        return mapping

    def _upsert_product(self, row: dict[str, Any], categories: dict[str, Category]) -> bool:
        title = str(row.get("title") or "").strip()
        if not title:
            raise CatalogImportError("Each product needs a title.")
        slug = str(row.get("slug") or slugify(title)).strip()
        category_slug = str(row.get("category") or "").strip()
        category = categories.get(category_slug) or Category.objects.filter(slug=category_slug).first()
        if category is None:
            raise CatalogImportError(f"Unknown category '{category_slug}' for product '{title}'.")
        status = str(row.get("status") or ProductStatus.ACTIVE)
        if status not in ProductStatus.values:
            raise CatalogImportError(f"Invalid status '{status}' for product '{title}'.")
        product, created = Product.objects.update_or_create(
            slug=slug,
            defaults={
                "title": title,
                "description": str(row.get("description") or "").strip(),
                "category": category,
                "status": status,
            },
        )
        variants = list(row.get("variants") or [])
        if row.get("variant"):
            variants.append(row["variant"])
        self._writer.upsert_variants(product, variants)
        label = row.get("label")
        if label is None:
            label = {
                "headline": (row.get("nutrition") or {}).get("headline", ""),
                "serving_size": (row.get("nutrition") or {}).get("serving_size", ""),
                "facts": (row.get("nutrition") or {}).get("facts") or [],
                "ingredients": row.get("ingredients") or [],
            }
        self._writer.replace_label(product, label)
        Additive.objects.filter(product=product).delete()
        for index, additive in enumerate(row.get("additives") or []):
            name = str(additive.get("name") or "").strip()
            if not name:
                continue
            Additive.objects.create(
                product=product,
                name=name[:160],
                code=str(additive.get("code") or "")[:40],
                is_present=bool(additive.get("is_present", False)),
                sort_order=index,
            )
        return created

    def _apply_related(self, row: dict[str, Any]) -> None:
        slugs = row.get("related_slugs") or []
        if not slugs:
            return
        slug = str(row.get("slug") or slugify(row.get("title") or "")).strip()
        product = Product.objects.filter(slug=slug).first()
        if product is None:
            return
        kind = str(row.get("related_kind") or "flavor")
        self._writer.replace_related(product, slugs, kind=kind)
