"""Import local product image folders into Cloudinary-backed ProductImage rows."""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path

from django.core.files.base import ContentFile
from django.db import close_old_connections, transaction
from django.db.utils import OperationalError

from catalog.image_fetch import IMAGE_EXTENSIONS, ImageFetchError
from core.cloudinary_storage import CloudinaryUploadError
from catalog.images import sync_image_order
from catalog.models import ImageRole, Product, ProductImage, ProductVariant
from core.uploads import MAX_IMAGE_BYTES

_REPLACEMENT_CHAR = "\ufffd"


def _norm(value: str) -> str:
    text = str(value or "").lower()
    text = text.replace("–", "-").replace("—", "-").replace(_REPLACEMENT_CHAR, "-")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def _dedupe_title(title: str) -> str:
    parts = [part.strip() for part in title.split(",")]
    if len(parts) >= 2 and parts[-1] == parts[-2]:
        parts = parts[:-1]
    return ", ".join(parts)


def _title_keys(title: str) -> set[str]:
    cleaned = _dedupe_title(title)
    keys = {_norm(cleaned), _norm(title)}
    if "," in cleaned:
        keys.add(_norm(cleaned.split(",", 1)[0]))
    for part in cleaned.split(","):
        keys.add(_norm(part))
    return {key for key in keys if key}


@dataclass
class AssetRow:
    brand: str
    sku: str
    folder: str
    image_files: list[str]
    notes: str = ""
    sortd_sku: str = ""


@dataclass
class AssetImportIssue:
    sku: str
    field: str
    message: str
    level: str = "warning"


@dataclass
class AssetImportResult:
    dry_run: bool
    matched: int = 0
    uploaded_products: int = 0
    uploaded_images: int = 0
    skipped_products: int = 0
    resized_images: int = 0
    issues: list[AssetImportIssue] = field(default_factory=list)

    @property
    def errors(self) -> list[AssetImportIssue]:
        return [issue for issue in self.issues if issue.level == "error"]


def load_asset_rows(assets_dir: Path) -> list[AssetRow]:
    manifest = assets_dir / "products.json"
    if not manifest.is_file():
        raise FileNotFoundError(f"products.json was not found in {assets_dir}")
    payload = json.loads(manifest.read_text(encoding="utf-8"))
    rows: list[AssetRow] = []
    for item in payload:
        rows.append(
            AssetRow(
                brand=str(item.get("brand") or ""),
                sku=str(item.get("sku") or ""),
                folder=str(item.get("folder") or ""),
                image_files=[str(name) for name in item.get("image_files") or []],
                notes=str(item.get("notes") or ""),
                sortd_sku=str(item.get("sortd_sku") or item.get("sortdSku") or ""),
            )
        )
    return rows


def build_product_index(products: list[Product]) -> dict[str, list[Product]]:
    index: dict[str, list[Product]] = {}
    for product in products:
        for key in _title_keys(product.title):
            index.setdefault(key, []).append(product)
    return index


def _brand_norm(value: str) -> str:
    return _norm(value)


def _folder_brand_and_name(folder: str) -> tuple[str, str]:
    leaf = folder.rsplit("/", 1)[-1]
    if " - " in leaf:
        brand, name = leaf.split(" - ", 1)
        return _brand_norm(brand), _norm(name.replace(" and ", " & "))
    return "", _norm(leaf.replace(" and ", " & "))


def _asset_brand(row: AssetRow) -> str:
    folder_brand, _ = _folder_brand_and_name(row.folder)
    return _brand_norm(row.brand) or folder_brand


def _asset_product_name(row: AssetRow) -> str:
    _, folder_name = _folder_brand_and_name(row.folder)
    return _norm(row.sku) or folder_name


def _product_catalog_name(product: Product) -> str:
    return _norm(_dedupe_title(product.title))


def _brands_align(product: Product, row: AssetRow) -> bool:
    product_brands = _product_brands_for_match(product)
    asset_brand = _asset_brand(row)
    if not product_brands:
        return True
    if not asset_brand:
        return False
    return asset_brand in product_brands


def _names_align(product: Product, row: AssetRow) -> bool:
    product_name = _product_catalog_name(product)
    asset_name = _asset_product_name(row)
    if not product_name or not asset_name:
        return False
    if product_name == asset_name:
        return True
    return product_name in asset_name or asset_name in product_name


def _exact_row_match(product: Product, row: AssetRow) -> bool:
    if not row.folder or not row.image_files:
        return False
    variant = product.variants.first()
    if variant and row.sortd_sku and variant.sku.upper() == row.sortd_sku.strip().upper():
        return True
    if not _brands_align(product, row):
        return False
    return _names_align(product, row)


_GENERIC_TOKENS = frozenset(
    {
        "the",
        "and",
        "with",
        "for",
        "oil",
        "bar",
        "protein",
        "whole",
        "truth",
        "organic",
        "natural",
        "pressed",
        "cold",
        "wood",
        "wooden",
        "snack",
        "studio",
        "paper",
        "boat",
        "gluten",
        "free",
        "vegan",
    }
)

# Catalog brand vs asset pack (known mismatches on Sortd SKU).
ASSET_MATCH_OVERRIDES: dict[str, tuple[str, str]] = {
    "SRT-PAN-022": ("Anweshan", "Wood Pressed Mustard Oil"),
}


def _significant_tokens(*parts: str) -> set[str]:
    tokens: set[str] = set()
    for part in parts:
        for token in _norm(part).split():
            if len(token) > 2 and token not in _GENERIC_TOKENS:
                tokens.add(token)
    return tokens


def _title_overlap_count(product: Product, row: AssetRow) -> int:
    folder_brand, folder_name = _folder_brand_and_name(row.folder)
    title_tokens = _significant_tokens(_dedupe_title(product.title))
    row_tokens = _significant_tokens(row.sku, folder_name)
    return len(title_tokens & row_tokens)


def _product_brands_for_match(product: Product) -> set[str]:
    brands = {_brand_norm(product.brand)}
    variant = product.variants.first()
    if variant and variant.sku.upper() in ASSET_MATCH_OVERRIDES:
        override_brand, _ = ASSET_MATCH_OVERRIDES[variant.sku.upper()]
        brands.add(_brand_norm(override_brand))
    return {brand for brand in brands if brand}


def score_product_row(product: Product, row: AssetRow) -> int:
    if not row.folder or not row.image_files:
        return -1

    variant = product.variants.first()
    if variant and row.sortd_sku and variant.sku.upper() == row.sortd_sku.strip().upper():
        return 500

    if not _brands_align(product, row):
        return -1

    product_brands = _product_brands_for_match(product)
    row_brand = _brand_norm(row.brand)
    folder_brand, folder_name = _folder_brand_and_name(row.folder)

    overlap = _title_overlap_count(product, row)
    if overlap == 0:
        return -1

    score = 80 if product_brands else 0
    title = _norm(_dedupe_title(product.title))
    row_name = _norm(row.sku)

    if row_name and (row_name in title or title in row_name):
        score += 60
    if folder_name and folder_name in title:
        score += 50

    row_tokens = [token for token in row_name.split() if len(token) > 2]
    if row_tokens and all(token in title for token in row_tokens[:4]):
        score += 25

    score += min(overlap, 4) * 10

    return score


def _row_for_override(product: Product, rows: list[AssetRow]) -> AssetRow | None:
    variant = product.variants.first()
    if variant is None:
        return None
    override = ASSET_MATCH_OVERRIDES.get(variant.sku.upper())
    if not override:
        return None
    want_brand, want_sku = _brand_norm(override[0]), _norm(override[1])
    for row in rows:
        if not row.folder or not row.image_files:
            continue
        if _brand_norm(row.brand) == want_brand and _norm(row.sku) == want_sku:
            return row
    return None


def assign_rows_to_products(
    products: list[Product],
    rows: list[AssetRow],
    *,
    min_score: int = 120,
) -> dict[int, AssetRow]:
    assignments: dict[int, AssetRow] = {}
    used_products: set[int] = set()
    used_rows: set[int] = set()

    def _claim(product: Product, row: AssetRow, row_index: int) -> None:
        assignments[product.id] = row
        used_products.add(product.id)
        used_rows.add(row_index)

    for product in products:
        row = _row_for_override(product, rows)
        if row is None:
            continue
        row_index = rows.index(row)
        if row_index in used_rows:
            continue
        _claim(product, row, row_index)

    for index, row in enumerate(rows):
        if index in used_rows or not row.folder or not row.image_files:
            continue
        if row.sortd_sku:
            for product in products:
                if product.id in used_products:
                    continue
                variant = product.variants.first()
                if variant and variant.sku.upper() == row.sortd_sku.strip().upper():
                    _claim(product, row, index)
                    break

    for index, row in enumerate(rows):
        if index in used_rows or not row.folder or not row.image_files:
            continue
        matches = [product for product in products if product.id not in used_products and _exact_row_match(product, row)]
        if len(matches) == 1:
            _claim(matches[0], row, index)

    eligible = [
        (index, row)
        for index, row in enumerate(rows)
        if row.folder and row.image_files and index not in used_rows
    ]
    eligible.sort(key=lambda item: len(_significant_tokens(item[1].sku)), reverse=True)

    for index, row in eligible:
        best_product: Product | None = None
        best_score = -1
        for product in products:
            if product.id in used_products:
                continue
            score = score_product_row(product, row)
            if score > best_score:
                best_score = score
                best_product = product
        if best_product is not None and best_score >= min_score:
            assignments[best_product.id] = row
            used_products.add(best_product.id)
            used_rows.add(index)

    return assignments


def match_keys_for_row(row: AssetRow) -> list[str]:
    keys = [_norm(row.sku), _norm(f"{row.brand} {row.sku}")]
    if " - " in row.sku:
        keys.append(_norm(row.sku.split(" - ", 1)[1]))
    folder_name = row.folder.rsplit("/", 1)[-1]
    if " - " in folder_name:
        keys.append(_norm(folder_name.split(" - ", 1)[1]))
    folder_norm = _norm(folder_name.replace(" and ", " & "))
    keys.append(folder_norm)
    return [key for key in dict.fromkeys(keys) if key]


def match_product(row: AssetRow, products: list[Product], index: dict[str, list[Product]]) -> Product | None:
    scored: list[tuple[int, Product]] = []
    for product in products:
        score = score_product_row(product, row)
        if score >= 120:
            scored.append((score, product))
    if scored:
        scored.sort(key=lambda item: item[0], reverse=True)
        return scored[0][1]

    for key in match_keys_for_row(row):
        matches = index.get(key, [])
        if len(matches) == 1:
            return matches[0]

    return None


def resolve_asset_folder(assets_dir: Path, row: AssetRow) -> Path:
    if not row.folder:
        raise FileNotFoundError(f"No image folder listed for '{row.brand} / {row.sku}'.")

    rel = row.folder.replace("\\", "/")
    direct = assets_dir / rel
    if direct.is_dir():
        return direct

    category, _, leaf = rel.rpartition("/")
    category_dir = assets_dir / category
    if not category_dir.is_dir():
        raise FileNotFoundError(f"Asset folder not found: {direct}")

    target = _norm(leaf.replace(" and ", " & "))
    for candidate in sorted(category_dir.iterdir()):
        if not candidate.is_dir():
            continue
        if _norm(candidate.name.replace(" and ", " & ")) == target:
            return candidate

    raise FileNotFoundError(f"Asset folder not found: {direct}")


def resolve_image_paths(assets_dir: Path, row: AssetRow) -> list[Path]:
    folder = resolve_asset_folder(assets_dir, row)
    paths: list[Path] = []
    for name in row.image_files:
        path = folder / name
        if not path.is_file():
            raise FileNotFoundError(f"Image not found: {path}")
        paths.append(path)
    return paths


def load_asset_image(path: Path) -> tuple[ContentFile, str, int, bool]:
    payload = path.read_bytes()
    suffix = path.suffix.lower()
    if suffix not in IMAGE_EXTENSIONS:
        raise ImageFetchError(f"Unsupported image type '{suffix or 'unknown'}'.")

    if len(payload) <= MAX_IMAGE_BYTES:
        return ContentFile(payload, name=path.name), path.name, len(payload), False

    from PIL import Image

    image = Image.open(BytesIO(payload))
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")

    resized = False
    for quality in (85, 75, 65, 55, 45):
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=quality, optimize=True)
        if buffer.tell() <= MAX_IMAGE_BYTES:
            name = f"{path.stem}.jpg"
            data = buffer.getvalue()
            return ContentFile(data, name=name), name, len(data), True

    working = image
    scale = 0.85
    while scale >= 0.35:
        size = (max(1, int(working.width * scale)), max(1, int(working.height * scale)))
        attempt = working.resize(size, Image.Resampling.LANCZOS)
        buffer = BytesIO()
        attempt.save(buffer, format="JPEG", quality=75, optimize=True)
        if buffer.tell() <= MAX_IMAGE_BYTES:
            name = f"{path.stem}.jpg"
            data = buffer.getvalue()
            return ContentFile(data, name=name), name, len(data), True
        scale -= 0.1

    raise ImageFetchError(f"Image is larger than 5 MB even after compression: {path.name}")


def _save_with_retry(image: ProductImage, storage_name: str, content: ContentFile, *, attempts: int = 4) -> None:
    delay = 1.0
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        if hasattr(content, "seek"):
            content.seek(0)
        try:
            image.file.save(storage_name, content, save=True)
            return
        except CloudinaryUploadError as exc:
            last_error = exc
            if attempt == attempts:
                break
            time.sleep(delay)
            delay = min(delay * 2, 8.0)
    assert last_error is not None
    raise last_error


def import_product_images(
    product: Product,
    paths: list[Path],
    *,
    dry_run: bool = False,
    force: bool = False,
) -> tuple[int, int]:
    if product.images.exists() and not force:
        return 0, 0
    if dry_run:
        resized = sum(1 for path in paths if path.stat().st_size > MAX_IMAGE_BYTES)
        return len(paths), resized

    uploaded = 0
    resized = 0
    with transaction.atomic():
        product.images.all().delete()
        for index, path in enumerate(paths):
            content, filename, byte_size, was_resized = load_asset_image(path)
            if was_resized:
                resized += 1
            storage_name = f"{product.slug}-{index + 1:02d}{Path(filename).suffix.lower()}"
            image = ProductImage(
                product=product,
                alt=product.title[:200],
                original_name=filename[:255],
                byte_size=byte_size,
                sort_order=index,
                role=ImageRole.PRIMARY if index == 0 else ImageRole.SECONDARY,
            )
            _save_with_retry(image, storage_name, content)
            uploaded += 1
        sync_image_order(product)
    return uploaded, resized


def products_with_colliding_titles(products: list[Product]) -> set[int]:
    """Product ids whose page title matches another SKU (e.g. two brands' 'Chana Dal')."""
    by_title: dict[str, list[Product]] = {}
    for product in products:
        key = _product_catalog_name(product)
        if not key:
            continue
        by_title.setdefault(key, []).append(product)
    colliding: set[int] = set()
    for group in by_title.values():
        if len(group) > 1:
            colliding.update(product.id for product in group)
    return colliding


class ProductAssetImporter:
    def __init__(self, assets_dir: Path):
        self.assets_dir = assets_dir.resolve()

    def run(
        self,
        *,
        dry_run: bool = False,
        force: bool = False,
        sku_filter: str | None = None,
        rematch_colliding_titles: bool = False,
    ) -> AssetImportResult:
        rows = load_asset_rows(self.assets_dir)
        products = list(Product.objects.prefetch_related("variants", "images").all())
        result = AssetImportResult(dry_run=dry_run)

        target_product_id: int | None = None
        if sku_filter:
            variant = ProductVariant.objects.select_related("product").filter(sku__iexact=sku_filter).first()
            if variant is None:
                result.issues.append(
                    AssetImportIssue(
                        sku_filter,
                        "sortd_sku",
                        f"No product variant found for '{sku_filter}'.",
                        level="error",
                    )
                )
                return result
            target_product_id = variant.product_id
            products = [variant.product]

        assignments = assign_rows_to_products(products, rows)
        assigned_rows = set(id(row) for row in assignments.values())
        colliding_ids = products_with_colliding_titles(products) if rematch_colliding_titles else set()

        for product in products:
            row = assignments.get(product.id)
            if row is None:
                if target_product_id is None and not product.images.exists():
                    variant_sku = product.variants.first().sku if product.variants.exists() else ""
                    result.issues.append(
                        AssetImportIssue(
                            variant_sku,
                            "match",
                            f"No asset folder matched '{product.brand} / {product.title}'.",
                        )
                    )
                continue

            result.matched += 1
            variant_sku = product.variants.first().sku if product.variants.exists() else row.sku

            try:
                paths = resolve_image_paths(self.assets_dir, row)
            except FileNotFoundError as exc:
                result.issues.append(AssetImportIssue(variant_sku, "folder", str(exc)))
                continue

            should_force = force or (rematch_colliding_titles and product.id in colliding_ids)
            if product.images.exists() and not should_force:
                result.skipped_products += 1
                continue

            uploaded = 0
            resized = 0
            for attempt in range(1, 3):
                close_old_connections()
                try:
                    uploaded, resized = import_product_images(
                        product, paths, dry_run=dry_run, force=should_force
                    )
                    break
                except (ImageFetchError, CloudinaryUploadError, OperationalError) as exc:
                    if attempt == 2 or isinstance(exc, ImageFetchError):
                        result.issues.append(AssetImportIssue(variant_sku, "upload", str(exc)))
                        uploaded = 0
                        break
                    time.sleep(2.0)

            if uploaded:
                result.uploaded_products += 1
                result.uploaded_images += uploaded
                result.resized_images += resized
                if not dry_run:
                    time.sleep(0.2)
            close_old_connections()

        if target_product_id is None:
            for row in rows:
                if not row.folder or not row.image_files:
                    continue
                if id(row) in assigned_rows:
                    continue
                result.issues.append(
                    AssetImportIssue(
                        row.sku,
                        "unused_asset",
                        f"Asset folder not assigned to any product: {row.brand} / {row.sku}.",
                    )
                )

        if target_product_id is not None and result.matched == 0:
            result.issues.append(
                AssetImportIssue(
                    sku_filter or "",
                    "match",
                    f"No asset row matched variant '{sku_filter}'.",
                    level="error",
                )
            )

        return result
