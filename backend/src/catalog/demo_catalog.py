"""SKUs and helpers for legacy demo / seed catalog data (not launch range)."""

from __future__ import annotations

import re

from catalog.models import Product, ProductImage, ProductVariant

# From Sortd_Demo_Products_Import / PLAAAY Figma demo workbook — not launch range.
DEMO_SORTD_SKUS = frozenset(
    {
        "SRT-EXAMPLE-001",
        "SRT-CHO-PLAAAY-PL",
        "SRT-CHO-PLAAAY-HZ",
        "SRT-CHO-PLAAAY-SS",
        "SRT-CHO-021",
        "SRT-CHO-022",
        "SRT-CHO-023",
        "SRT-CHO-024",
        "SRT-CHO-025",
    }
)

_LEGACY_STOREFRONT_SKU = re.compile(r"^(BRK|SNK|CHC|DRK)-", re.I)


def iter_demo_products():
    """Products that should not remain after launch-range import."""
    seen: set[int] = set()
    for variant in ProductVariant.objects.select_related("product").filter(sku__in=DEMO_SORTD_SKUS):
        if variant.product_id not in seen:
            seen.add(variant.product_id)
            yield variant.product

    for variant in ProductVariant.objects.select_related("product").exclude(sku__istartswith="SRT-"):
        if _LEGACY_STOREFRONT_SKU.match(variant.sku or "") and variant.product_id not in seen:
            seen.add(variant.product_id)
            yield variant.product


def delete_demo_catalog_products(*, delete_media: bool = True) -> tuple[int, list[str]]:
    removed_skus: list[str] = []
    count = 0
    for product in list(iter_demo_products()):
        for variant in product.variants.all():
            removed_skus.append(variant.sku)
        if delete_media:
            for image in ProductImage.objects.filter(product=product).exclude(file=""):
                image.file.delete(save=False)
        product.delete()
        count += 1
    return count, sorted(set(removed_skus))
