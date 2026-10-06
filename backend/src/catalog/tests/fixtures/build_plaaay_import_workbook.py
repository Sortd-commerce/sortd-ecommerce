"""Build the final PLAAAY chocolate import workbook (3 flavours, Figma-aligned)."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
REPO_ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(ROOT))

from openpyxl import load_workbook

from catalog.import_columns import IMPORT_COLUMNS
from catalog.import_template import build_import_workbook_from_rows

OUTPUT = REPO_ROOT / "catalog" / "import" / "Sortd_PLAAAY_Chocolate_Import.xlsx"
IMAGE_DIR = OUTPUT.parent / "images"
LEGACY_TEST_OUTPUT = Path(__file__).resolve().parent / "plaaay_chocolate_test.xlsx"

FIGMA_SCREENSHOT = (
    Path.home()
    / ".cursor"
    / "projects"
    / "c-Users-omkar-OneDrive-Desktop-Projects-sortd-backend"
    / "assets"
    / "c__Users_omkar_AppData_Roaming_Cursor_User_workspaceStorage_d83ce5e89f8464cb30e59f105c11fa54_images_image-18647d55-bfa8-4c8e-b6e4-e7b6a61bc48f.jpg"
)
PROMO_CHOCOLATE = REPO_ROOT / "frontend" / "public" / "images" / "promo-chocolate.png"
FIXTURE_IMAGES = Path(__file__).resolve().parent / "images"

GALLERY_IMAGES = (
    "images/plaaay-gallery-1.png",
    "images/plaaay-gallery-2.png",
    "images/plaaay-gallery-3.png",
    "images/plaaay-gallery-4.png",
    "images/plaaay-gallery-5.png",
)

SHARED = {
    "status": "Live",
    "product_name": "70% Dark Chocolate",
    "parent_group": "PLAAAY 70% Dark Chocolate",
    "variation_theme": "Flavour",
    "brand": "PLAAAY",
    "pack_line": "6 bars × 80 g",
    "units_in_pack": 6,
    "aisle": "Chocolate",
    "shelf": "Dark chocolate",
    "label_template": "Chocolate",
    "tags": "dark chocolate, coconut sugar, plaaay",
    "price": 60,
    "compare_price": "",
    "stock": 50,
    "max_order": 6,
    "headline": "70% cacao. Six ingredients. Coconut sugar, nothing more.",
    "gallery": ", ".join(GALLERY_IMAGES),
    "basis": "Per bar",
    "serving": 80,
    "printed_per": 80,
    "energy_kcal": 472,
    "protein_g": 6.4,
    "carbs_g": 28.8,
    "sugars_g": 17.6,
    "added_sugars_g": 0,
    "fibre_g": 8.0,
    "fat_g": 36.0,
    "saturates_g": 21.6,
    "trans_fat_g": 0,
    "cholesterol_mg": 0,
    "sodium_mg": 96,
    "cacao_pct": 70,
    "lv_sugars_level": "Medium",
    "lv_fat_level": "High",
    "lv_saturates_level": "High",
    "nutrition_note": "Potassium isn't listed on this pack. Levels: UK FSA, per 100 g.",
    "shares_printed": "Yes",
    "ingredient_note": "Coconut sugar is the only added sweetener.",
    "allergens": "Tree nuts",
    "may_contain": "Milk, Peanuts",
    "how_to_use": "Break into pieces and enjoy.",
    "chk_hidden_result": "0",
    "chk_banned_result": "0",
}

FLAVOURS = (
    {
        "sortd_sku": "SRT-CHO-PLAAAY-PL",
        "variant": "Plain",
        "main_image": "images/plaaay-plain.jpg",
        "short_desc": "70% cacao dark chocolate. Sweetened with coconut sugar — six ingredients, nothing else.",
        "ingredients_full": "Cacao mass, Coconut sugar, Cacao butter, Vanilla, Emulsifier (sunflower lecithin)",
        "ing1_name": "Cacao mass",
        "ing1_pct": 50,
        "ing2_name": "Coconut sugar",
        "ing2_pct": 28,
        "ing3_name": "Cacao butter",
        "ing3_pct": 18,
        "ing4_name": "Vanilla",
        "ing4_pct": 2,
        "ing5_name": "Emulsifier (sunflower lecithin)",
        "ing5_pct": 2,
    },
    {
        "sortd_sku": "SRT-CHO-PLAAAY-HZ",
        "variant": "Hazelnut",
        "main_image": "images/plaaay-hazelnut.jpg",
        "short_desc": "70% cacao dark chocolate with roasted hazelnuts. Sweetened with coconut sugar.",
        "ingredients_full": "Cacao mass, Coconut sugar, Cacao butter, Hazelnuts, Vanilla, Emulsifier (sunflower lecithin)",
        "ing1_name": "Cacao mass",
        "ing1_pct": 42,
        "ing2_name": "Coconut sugar",
        "ing2_pct": 24,
        "ing3_name": "Cacao butter",
        "ing3_pct": 16,
        "ing4_name": "Hazelnuts",
        "ing4_pct": 12,
        "ing5_name": "Vanilla",
        "ing5_pct": 2,
        "ing6_name": "Emulsifier (sunflower lecithin)",
        "ing6_pct": 4,
    },
    {
        "sortd_sku": "SRT-CHO-PLAAAY-SS",
        "variant": "Sea Salt",
        "main_image": "images/plaaay-sea-salt.jpg",
        "short_desc": "70% cacao dark chocolate with sea salt. Sweetened with coconut sugar.",
        "ingredients_full": "Cacao mass, Coconut sugar, Cacao butter, Sea salt, Vanilla, Emulsifier (sunflower lecithin)",
        "ing1_name": "Cacao mass",
        "ing1_pct": 45,
        "ing2_name": "Coconut sugar",
        "ing2_pct": 25,
        "ing3_name": "Cacao butter",
        "ing3_pct": 20,
        "ing4_name": "Sea salt",
        "ing4_pct": 1,
        "ing5_name": "Vanilla",
        "ing5_pct": 1,
        "ing6_name": "Emulsifier (sunflower lecithin)",
        "ing6_pct": 8,
    },
)


def build_rows() -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for flavour in FLAVOURS:
        row = {column.key: "" for column in IMPORT_COLUMNS}
        row.update(SHARED)
        row.update(flavour)
        rows.append(row)
    return rows


def _copy_if_missing(target: Path, source: Path) -> None:
    if target.is_file():
        return
    if source.is_file():
        shutil.copy2(source, target)


def prepare_import_images() -> None:
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    hero_source = FIGMA_SCREENSHOT if FIGMA_SCREENSHOT.is_file() else PROMO_CHOCOLATE
    gallery_source = PROMO_CHOCOLATE if PROMO_CHOCOLATE.is_file() else hero_source

    copies = {
        IMAGE_DIR / "plaaay-sea-salt.jpg": hero_source,
        IMAGE_DIR / "plaaay-plain.jpg": gallery_source,
        IMAGE_DIR / "plaaay-hazelnut.jpg": gallery_source,
        IMAGE_DIR / "plaaay-gallery-1.png": gallery_source,
        IMAGE_DIR / "plaaay-gallery-2.png": gallery_source,
        IMAGE_DIR / "plaaay-gallery-3.png": hero_source,
        IMAGE_DIR / "plaaay-gallery-4.png": gallery_source,
        IMAGE_DIR / "plaaay-gallery-5.png": hero_source,
        IMAGE_DIR / "chocolate-aisle.png": gallery_source,
    }
    for target, source in copies.items():
        _copy_if_missing(target, source)
        if not target.is_file() and FIXTURE_IMAGES.is_dir():
            fixture_source = FIXTURE_IMAGES / target.name
            _copy_if_missing(target, fixture_source)


def patch_aisle_image() -> None:
    workbook = load_workbook(OUTPUT)
    sheet = workbook["Aisles"]
    for row in sheet.iter_rows(min_row=2, values_only=False):
        if row[0].value == "Chocolate":
            row[1].value = "images/chocolate-aisle.png"
            break
    workbook.save(OUTPUT)


def main() -> None:
    prepare_import_images()
    rows = build_rows()
    row_count = build_import_workbook_from_rows(rows, OUTPUT, preserve_image_paths=True)
    patch_aisle_image()

    if LEGACY_TEST_OUTPUT.is_file():
        LEGACY_TEST_OUTPUT.unlink()

    downloads_copy = Path.home() / "Downloads" / OUTPUT.name
    shutil.copy2(OUTPUT, downloads_copy)

    print(f"Wrote {OUTPUT} ({row_count} flavour rows)")
    print(f"Copied to {downloads_copy}")
    print(f"Images in {IMAGE_DIR}")
    if not LEGACY_TEST_OUTPUT.exists():
        print("Removed legacy single-row test workbook")


if __name__ == "__main__":
    main()
