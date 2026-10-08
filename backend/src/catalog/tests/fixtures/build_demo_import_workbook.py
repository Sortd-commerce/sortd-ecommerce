"""Build a demo import workbook with clean-label products and real product images."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[3]
REPO_ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(ROOT))

from catalog.import_columns import IMPORT_COLUMNS
from catalog.import_template import build_import_workbook_from_rows

OUTPUT = REPO_ROOT / "catalog" / "import" / "Sortd_Demo_Products_Import.xlsx"
IMAGE_DIR = OUTPUT.parent / "images"

# Pexels CDN — stable direct links for import testing.
IMAGE_SOURCES: dict[str, str] = {
    "plaaay-plain.jpg": "https://images.pexels.com/photos/65882/chocolate-dark-coffee-confiserie-65882.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "plaaay-hazelnut.jpg": "https://images.pexels.com/photos/1126941/pexels-photo-1126941.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "plaaay-sea-salt.jpg": "https://images.pexels.com/photos/918327/pexels-photo-918327.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "cho-85-ecuador.jpg": "https://images.pexels.com/photos/4110271/pexels-photo-4110271.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "cho-ruby.jpg": "https://images.pexels.com/photos/65882/chocolate-dark-coffee-confiserie-65882.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "cho-honeycomb.jpg": "https://images.pexels.com/photos/6119175/pexels-photo-6119175.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "cho-praline.jpg": "https://images.pexels.com/photos/4196530/pexels-photo-4196530.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "cho-mint.jpg": "https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "snack-protein.jpg": "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "snack-almond-bar.jpg": "https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "snack-almonds.jpg": "https://images.pexels.com/photos/1295572/pexels-photo-1295572.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "snack-granola.jpg": "https://images.pexels.com/photos/1153236/pexels-photo-1153236.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "chocolate-aisle.png": "https://images.pexels.com/photos/65882/chocolate-dark-coffee-confiserie-65882.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "gallery-choc-1.jpg": "https://images.pexels.com/photos/918327/pexels-photo-918327.jpeg?auto=compress&cs=tinysrgb&w=800",
    "gallery-choc-2.jpg": "https://images.pexels.com/photos/4110271/pexels-photo-4110271.jpeg?auto=compress&cs=tinysrgb&w=800",
}

FIXTURE_IMAGES = Path(__file__).resolve().parent / "images"

CHOCOLATE_NUTRITION = {
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
    "nutrition_note": "Traffic light levels use UK FSA guidance, per 100 g.",
    "shares_printed": "Yes",
    "ingredient_note": "Coconut sugar is the only added sweetener.",
    "allergens": "Tree nuts",
    "may_contain": "Milk, Peanuts",
    "how_to_use": "Break into pieces and enjoy.",
    "chk_hidden_result": "0",
    "chk_banned_result": "0",
}

PLAAAY_SHARED = {
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
    "stock": 50,
    "max_order": 6,
    "headline": "70% cacao. Six ingredients. Coconut sugar, nothing more.",
    "gallery": f"{IMAGE_SOURCES['gallery-choc-1.jpg']}, {IMAGE_SOURCES['gallery-choc-2.jpg']}",
    **CHOCOLATE_NUTRITION,
}

PRODUCTS: tuple[dict[str, object], ...] = (
    {
        **PLAAAY_SHARED,
        "sortd_sku": "SRT-CHO-PLAAAY-PL",
        "variant": "Plain",
        "main_image": IMAGE_SOURCES["plaaay-plain.jpg"],
        "short_desc": "70% cacao dark chocolate sweetened with coconut sugar. Six ingredients, nothing else.",
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
        **PLAAAY_SHARED,
        "sortd_sku": "SRT-CHO-PLAAAY-HZ",
        "variant": "Hazelnut",
        "main_image": IMAGE_SOURCES["plaaay-hazelnut.jpg"],
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
        **PLAAAY_SHARED,
        "sortd_sku": "SRT-CHO-PLAAAY-SS",
        "variant": "Sea Salt",
        "main_image": IMAGE_SOURCES["plaaay-sea-salt.jpg"],
        "short_desc": "70% cacao dark chocolate with sea salt flakes. Sweetened with coconut sugar.",
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
    {
        "sortd_sku": "SRT-CHO-021",
        "status": "Live",
        "product_name": "85% Ecuador Dark Chocolate",
        "brand": "Sortd Select",
        "pack_line": "80 g bar",
        "aisle": "Chocolate",
        "shelf": "Dark chocolate",
        "label_template": "Chocolate",
        "tags": "dark chocolate, single origin, low sugar",
        "price": 22,
        "stock": 40,
        "max_order": 8,
        "short_desc": "Single-origin Ecuador cacao at 85%. Intense, short ingredient list.",
        "headline": "Ecuador cacao. 85% solids. Four ingredients.",
        "main_image": IMAGE_SOURCES["cho-85-ecuador.jpg"],
        "gallery": IMAGE_SOURCES["gallery-choc-1.jpg"],
        "basis": "Per bar",
        "serving": 80,
        "printed_per": 80,
        "energy_kcal": 520,
        "protein_g": 8.2,
        "carbs_g": 22.0,
        "sugars_g": 12.0,
        "added_sugars_g": 0,
        "fibre_g": 11.0,
        "fat_g": 42.0,
        "saturates_g": 25.0,
        "cacao_pct": 85,
        "lv_sugars_level": "Low",
        "lv_fat_level": "High",
        "lv_saturates_level": "High",
        "ingredients_full": "Cacao mass, Cacao butter, Coconut sugar, Vanilla",
        "shares_printed": "Yes",
        "ing1_name": "Cacao mass",
        "ing1_pct": 70,
        "ing2_name": "Cacao butter",
        "ing2_pct": 12,
        "ing3_name": "Coconut sugar",
        "ing3_pct": 10,
        "ing4_name": "Vanilla",
        "ing4_pct": 8,
        "allergens": "None",
        "may_contain": "Tree nuts, Milk",
        "how_to_use": "Snap and savour slowly.",
        "chk_hidden_result": "0",
        "chk_banned_result": "0",
    },
    {
        "sortd_sku": "SRT-CHO-022",
        "status": "Live",
        "product_name": "Ruby Raspberry Chocolate",
        "brand": "Sortd Select",
        "pack_line": "75 g bar",
        "aisle": "Chocolate",
        "shelf": "Flavoured chocolate",
        "label_template": "Chocolate",
        "tags": "ruby chocolate, raspberry, no artificial colours",
        "price": 24,
        "stock": 35,
        "short_desc": "Ruby cacao with freeze-dried raspberry. No artificial colours or flavours.",
        "headline": "Ruby cacao. Real raspberry. Nothing artificial.",
        "main_image": IMAGE_SOURCES["cho-ruby.jpg"],
        "basis": "Per bar",
        "serving": 75,
        "printed_per": 75,
        "energy_kcal": 430,
        "protein_g": 5.5,
        "carbs_g": 34.0,
        "sugars_g": 28.0,
        "added_sugars_g": 14.0,
        "fat_g": 28.0,
        "saturates_g": 17.0,
        "cacao_pct": 47,
        "lv_sugars_level": "High",
        "lv_fat_level": "Medium",
        "ingredients_full": "Cane sugar, Cacao butter, Skimmed milk powder, Freeze-dried raspberry, Cacao mass, Emulsifier (sunflower lecithin)",
        "shares_printed": "Yes",
        "allergens": "Milk",
        "may_contain": "Tree nuts, Peanuts",
        "how_to_use": "Break and share.",
        "chk_hidden_result": "0",
        "chk_banned_result": "0",
    },
    {
        "sortd_sku": "SRT-CHO-023",
        "status": "Live",
        "product_name": "Honeycomb Milk Chocolate",
        "brand": "Sortd Select",
        "pack_line": "80 g bar",
        "aisle": "Chocolate",
        "shelf": "Milk chocolate",
        "label_template": "Chocolate",
        "tags": "milk chocolate, honeycomb",
        "price": 19,
        "stock": 45,
        "short_desc": "Creamy milk chocolate with crunchy honeycomb pieces.",
        "headline": "Milk chocolate. Honeycomb crunch. Short list.",
        "main_image": IMAGE_SOURCES["cho-honeycomb.jpg"],
        "basis": "Per bar",
        "serving": 80,
        "printed_per": 80,
        "energy_kcal": 495,
        "protein_g": 6.0,
        "carbs_g": 52.0,
        "sugars_g": 48.0,
        "added_sugars_g": 42.0,
        "fat_g": 28.0,
        "saturates_g": 17.0,
        "cacao_pct": 32,
        "lv_sugars_level": "High",
        "lv_fat_level": "Medium",
        "ingredients_full": "Sugar, Whole milk powder, Cacao butter, Honeycomb (sugar, glucose syrup, raising agent), Cacao mass, Emulsifier (sunflower lecithin)",
        "shares_printed": "Yes",
        "allergens": "Milk",
        "may_contain": "Tree nuts, Peanuts, Gluten",
        "how_to_use": "Break into pieces and enjoy.",
        "chk_hidden_result": "0",
        "chk_banned_result": "0",
    },
    {
        "sortd_sku": "SRT-CHO-024",
        "status": "Live",
        "product_name": "Hazelnut Praline Chocolate",
        "brand": "Sortd Select",
        "pack_line": "80 g bar",
        "aisle": "Chocolate",
        "shelf": "Flavoured chocolate",
        "label_template": "Chocolate",
        "tags": "hazelnut, praline, milk chocolate",
        "price": 21,
        "stock": 38,
        "short_desc": "Milk chocolate with roasted hazelnut praline. No palm oil.",
        "headline": "Roasted hazelnuts. No palm oil.",
        "main_image": IMAGE_SOURCES["cho-praline.jpg"],
        "basis": "Per bar",
        "serving": 80,
        "printed_per": 80,
        "energy_kcal": 510,
        "protein_g": 7.5,
        "carbs_g": 46.0,
        "sugars_g": 42.0,
        "added_sugars_g": 38.0,
        "fat_g": 32.0,
        "saturates_g": 16.0,
        "cacao_pct": 30,
        "ingredients_full": "Sugar, Hazelnuts, Cacao butter, Whole milk powder, Cacao mass, Emulsifier (sunflower lecithin)",
        "shares_printed": "Yes",
        "allergens": "Milk, Tree nuts",
        "may_contain": "Peanuts",
        "how_to_use": "Break and enjoy.",
        "chk_hidden_result": "0",
        "chk_banned_result": "0",
    },
    {
        "sortd_sku": "SRT-CHO-025",
        "status": "Live",
        "product_name": "Mint Cacao Bar",
        "brand": "Sortd Select",
        "pack_line": "80 g bar",
        "aisle": "Chocolate",
        "shelf": "Dark chocolate",
        "label_template": "Chocolate",
        "tags": "dark chocolate, mint, peppermint",
        "price": 20,
        "stock": 42,
        "short_desc": "72% dark chocolate with natural peppermint oil.",
        "headline": "Dark cacao. Real peppermint oil.",
        "main_image": IMAGE_SOURCES["cho-mint.jpg"],
        "basis": "Per bar",
        "serving": 80,
        "printed_per": 80,
        "energy_kcal": 465,
        "protein_g": 6.2,
        "carbs_g": 30.0,
        "sugars_g": 18.0,
        "added_sugars_g": 0,
        "fat_g": 34.0,
        "saturates_g": 20.0,
        "cacao_pct": 72,
        "ingredients_full": "Cacao mass, Coconut sugar, Cacao butter, Peppermint oil, Emulsifier (sunflower lecithin)",
        "shares_printed": "Yes",
        "allergens": "None",
        "may_contain": "Milk, Tree nuts",
        "how_to_use": "Store cool. Break and enjoy.",
        "chk_hidden_result": "0",
        "chk_banned_result": "0",
    },
    {
        "sortd_sku": "SRT-SNK-031",
        "status": "Live",
        "product_name": "Cacao Protein Bar",
        "brand": "Sortd Fuel",
        "pack_line": "55 g bar",
        "aisle": "Snacks & bars",
        "shelf": "Protein bars",
        "label_template": "Protein & snack bars",
        "tags": "protein, cacao, no artificial sweeteners",
        "price": 14,
        "stock": 60,
        "short_desc": "12 g plant protein with cacao and dates. No artificial sweeteners.",
        "headline": "12 g protein. Dates and cacao. No junk.",
        "main_image": IMAGE_SOURCES["snack-protein.jpg"],
        "basis": "Per bar",
        "serving": 55,
        "printed_per": 55,
        "energy_kcal": 220,
        "protein_g": 12.0,
        "carbs_g": 24.0,
        "sugars_g": 16.0,
        "added_sugars_g": 0,
        "fibre_g": 6.0,
        "fat_g": 9.0,
        "saturates_g": 3.0,
        "ingredients_full": "Dates, Pea protein, Cacao nibs, Almond butter, Coconut oil, Sea salt",
        "shares_printed": "Yes",
        "allergens": "Tree nuts",
        "may_contain": "Peanuts, Sesame",
        "how_to_use": "Grab post-workout or as a midday snack.",
        "chk_hidden_result": "0",
        "chk_banned_result": "0",
    },
    {
        "sortd_sku": "SRT-SNK-032",
        "status": "Live",
        "product_name": "Almond Butter Bar",
        "brand": "Sortd Fuel",
        "pack_line": "50 g bar",
        "aisle": "Snacks & bars",
        "shelf": "Protein bars",
        "label_template": "Protein & snack bars",
        "tags": "almond butter, snack bar, gluten free",
        "price": 13,
        "stock": 55,
        "short_desc": "Almond butter and oats with a pinch of sea salt. Gluten free.",
        "headline": "Almond butter first. Five ingredients.",
        "main_image": IMAGE_SOURCES["snack-almond-bar.jpg"],
        "basis": "Per bar",
        "serving": 50,
        "printed_per": 50,
        "energy_kcal": 245,
        "protein_g": 8.0,
        "carbs_g": 18.0,
        "sugars_g": 10.0,
        "added_sugars_g": 4.0,
        "fibre_g": 4.0,
        "fat_g": 16.0,
        "saturates_g": 2.5,
        "ingredients_full": "Almond butter, Rolled oats, Honey, Coconut oil, Sea salt",
        "shares_printed": "Yes",
        "allergens": "Tree nuts, Oats",
        "may_contain": "Peanuts, Sesame",
        "how_to_use": "Unwrap and enjoy.",
        "chk_hidden_result": "0",
        "chk_banned_result": "0",
    },
    {
        "sortd_sku": "SRT-SNK-033",
        "status": "Live",
        "product_name": "Sea Salt Roasted Almonds",
        "brand": "Sortd Pantry",
        "pack_line": "150 g pouch",
        "aisle": "Snacks & bars",
        "shelf": "Nuts & seeds",
        "label_template": "Savoury snacks",
        "tags": "almonds, roasted, sea salt",
        "price": 18,
        "stock": 70,
        "short_desc": "Dry-roasted almonds with sea salt. Two ingredients.",
        "headline": "Almonds. Sea salt. That's it.",
        "main_image": IMAGE_SOURCES["snack-almonds.jpg"],
        "basis": "Per 30 g serving",
        "serving": 30,
        "printed_per": 100,
        "energy_kcal": 180,
        "protein_g": 6.0,
        "carbs_g": 6.0,
        "sugars_g": 1.0,
        "added_sugars_g": 0,
        "fat_g": 15.0,
        "saturates_g": 1.2,
        "sodium_mg": 120,
        "ingredients_full": "Almonds, Sea salt",
        "shares_printed": "Yes",
        "allergens": "Tree nuts",
        "may_contain": "Peanuts, Sesame",
        "how_to_use": "Snack straight from the pouch.",
        "chk_hidden_result": "0",
        "chk_banned_result": "0",
    },
    {
        "sortd_sku": "SRT-SNK-034",
        "status": "Live",
        "product_name": "Cacao Granola Clusters",
        "brand": "Sortd Pantry",
        "pack_line": "300 g pouch",
        "aisle": "Breakfast & spreads",
        "shelf": "Granola",
        "label_template": "Breakfast & oats",
        "tags": "granola, cacao, breakfast",
        "price": 26,
        "stock": 30,
        "short_desc": "Toasted oat clusters with cacao nibs and coconut. Low added sugar.",
        "headline": "Toasted oats. Cacao nibs. Light sweetness.",
        "main_image": IMAGE_SOURCES["snack-granola.jpg"],
        "basis": "Per 45 g serving",
        "serving": 45,
        "printed_per": 100,
        "energy_kcal": 195,
        "protein_g": 5.0,
        "carbs_g": 28.0,
        "sugars_g": 8.0,
        "added_sugars_g": 5.0,
        "fibre_g": 4.5,
        "fat_g": 7.0,
        "saturates_g": 3.0,
        "ingredients_full": "Rolled oats, Coconut flakes, Cacao nibs, Honey, Coconut oil, Cinnamon",
        "shares_printed": "Yes",
        "allergens": "Oats",
        "may_contain": "Tree nuts, Peanuts, Sesame",
        "how_to_use": "Serve with yoghurt or milk.",
        "chk_hidden_result": "0",
        "chk_banned_result": "0",
    },
)


def download_images() -> None:
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    for filename, url in IMAGE_SOURCES.items():
        target = IMAGE_DIR / filename
        if target.is_file() and target.stat().st_size > 10_000:
            continue
        try:
            request = Request(url, headers={"User-Agent": "SortdCatalogImporter/1.0"})
            payload = urlopen(request, timeout=60).read()
            if len(payload) < 1000:
                raise RuntimeError("response too small")
            target.write_bytes(payload)
            print(f"  saved {filename} ({len(payload) // 1024} KB)")
        except Exception as exc:
            fallback = FIXTURE_IMAGES / filename
            if not fallback.is_file() and FIXTURE_IMAGES.is_dir():
                for candidate in FIXTURE_IMAGES.iterdir():
                    if candidate.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
                        fallback = candidate
                        break
            if fallback.is_file():
                shutil.copy2(fallback, target)
                print(f"  copied fallback for {filename} from {fallback.name}")
            else:
                raise RuntimeError(f"Could not download {filename}: {exc}") from exc


def build_rows() -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for product in PRODUCTS:
        row = {column.key: "" for column in IMPORT_COLUMNS}
        row.update(product)
        rows.append(row)
    return rows


def patch_aisle_image() -> None:
    from openpyxl import load_workbook

    workbook = load_workbook(OUTPUT)
    sheet = workbook["Aisles"]
    for row in sheet.iter_rows(min_row=2, values_only=False):
        if row[0].value == "Chocolate":
            row[1].value = IMAGE_SOURCES["chocolate-aisle.png"]
            break
    workbook.save(OUTPUT)


def main() -> None:
    print("Downloading product images…")
    download_images()
    rows = build_rows()
    row_count = build_import_workbook_from_rows(rows, OUTPUT, preserve_image_paths=False)
    patch_aisle_image()

    downloads_copy = Path.home() / "Downloads" / OUTPUT.name
    shutil.copy2(OUTPUT, downloads_copy)

    print(f"\nWrote {OUTPUT} ({row_count} products)")
    print(f"Copied to {downloads_copy}")
    print(f"Images in {IMAGE_DIR}")
    print("\nImport from admin > Products > Import, or run:")
    print(f'  python src/manage.py import_excel_catalog "{OUTPUT}" --dry-run')


if __name__ == "__main__":
    main()
