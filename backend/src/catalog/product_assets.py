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
            )
        )
    return rows


def build_product_index(products: list[Product]) -> dict[str, list[Product]]:
    index: dict[str, list[Product]] = {}
    for product in products:
        for key in _title_keys(product.title):
            index.setdefault(key, []).append(product)
    return index


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
    for key in match_keys_for_row(row):
        matches = index.get(key, [])
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            return matches[0]

    sku_norm = _norm(row.sku)
    for product in products:
        title_norm = _norm(_dedupe_title(product.title))
        if sku_norm in title_norm:
            return product
        tokens = [token for token in sku_norm.split() if len(token) > 2]
        if tokens and all(token in title_norm for token in tokens[:3]):
            return product
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


class ProductAssetImporter:
    def __init__(self, assets_dir: Path):
        self.assets_dir = assets_dir.resolve()

    def run(
        self,
        *,
        dry_run: bool = False,
        force: bool = False,
        sku_filter: str | None = None,
    ) -> AssetImportResult:
        rows = load_asset_rows(self.assets_dir)
        products = list(Product.objects.prefetch_related("variants", "images").all())
        index = build_product_index(products)
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

        for row in rows:
            if not row.folder or not row.image_files:
                continue

            product = match_product(row, products, index)
            if product is None:
                if target_product_id is None:
                    result.issues.append(
                        AssetImportIssue(
                            row.sku,
                            "match",
                            f"No database product matched '{row.brand} / {row.sku}'.",
                        )
                    )
                continue

            if target_product_id is not None and product.id != target_product_id:
                continue

            result.matched += 1
            variant_sku = product.variants.first().sku if product.variants.exists() else row.sku

            try:
                paths = resolve_image_paths(self.assets_dir, row)
            except FileNotFoundError as exc:
                result.issues.append(AssetImportIssue(variant_sku, "folder", str(exc)))
                continue

            if product.images.exists() and not force:
                result.skipped_products += 1
                result.issues.append(
                    AssetImportIssue(
                        variant_sku,
                        "images",
                        f"Skipped {product.title}: already has {product.images.count()} image(s). Use --force to replace.",
                    )
                )
                continue

            uploaded = 0
            resized = 0
            for attempt in range(1, 3):
                close_old_connections()
                try:
                    uploaded, resized = import_product_images(product, paths, dry_run=dry_run, force=force)
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

        if target_product_id is not None and result.matched == 0:
            result.issues.append(
                AssetImportIssue(
                    sku_filter or "",
                    "match",
                    f"No asset row in products.json matched variant '{sku_filter}'.",
                    level="error",
                )
            )

        return result
