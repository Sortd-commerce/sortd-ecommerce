"""Rebuild the full Sortd import workbook from Downloads source + example row."""

from __future__ import annotations

import re
import shutil
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any

from openpyxl import load_workbook
from openpyxl.styles import Border, Font, PatternFill, Side

ROOT = Path(__file__).resolve().parents[3]
REPO_ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(ROOT))

from catalog.import_columns import IMPORT_COLUMNS, LIST_VALUES
from catalog.import_template import build_import_workbook_from_rows

SOURCE = Path.home() / "Downloads" / "Sortd_Product_Import_Formatted.xlsx"
FALLBACK_SOURCE = Path.home() / "Downloads" / "Sortd_Product_Listing.xlsx"
OUTPUT = REPO_ROOT / "catalog" / "import" / "Sortd_Product_Import.xlsx"
DOWNLOADS_COPY = Path.home() / "Downloads" / "Sortd_Product_Import.xlsx"

SKU_RE = re.compile(r"^SRT-[A-Z0-9-]+$", re.IGNORECASE)
INSTRUCTION_MARKERS = {
    "sortd fills",
    "from supplier",
    "unique code",
    "shown as the big title",
    "pick from the list",
    "top-level shop aisle",
    "reference only",
    "auto",
    "example",
}

EXAMPLE_FILL = PatternFill("solid", fgColor="FFF3CD")
EXAMPLE_FONT = Font(bold=True, color="5C4A00")
THIN_BORDER = Border(
    left=Side(style="thin", color="D0C8BC"),
    right=Side(style="thin", color="D0C8BC"),
    top=Side(style="thin", color="D0C8BC"),
    bottom=Side(style="thin", color="D0C8BC"),
)

# Standalone test import row — never merge into the master listing.
REMOVE_SKUS = frozenset(
    {
        "SRT-CHO-PLAAAY-SS",
        "SRT-CHO-PLAAAY-PL",
        "SRT-CHO-PLAAAY-HZ",
        "SRT-EXAMPLE-001",
    }
)

PLAAAY_FLAVOURS: tuple[dict[str, Any], ...] = (
    {
        "sortd_sku": "SRT-CHO-PLAAAY-PL",
        "status": "Live",
        "product_name": "70% Dark Chocolate",
        "variant": "Plain",
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
        "short_desc": "70% cacao dark chocolate. Sweetened with coconut sugar — six ingredients, nothing else.",
        "headline": "70% cacao. Six ingredients. Coconut sugar, nothing more.",
        "main_image": "https://example.com/plaaay-plain.jpg",
        "gallery": ", ".join(f"https://example.com/plaaay-gallery-{index}.jpg" for index in range(1, 6)),
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
        "ingredients_full": "Cacao mass, Coconut sugar, Cacao butter, Vanilla, Emulsifier (sunflower lecithin)",
        "shares_printed": "Yes",
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
        "ingredient_note": "Coconut sugar is the only added sweetener.",
        "allergens": "Tree nuts",
        "may_contain": "Milk, Peanuts",
        "how_to_use": "Break into pieces and enjoy.",
        "chk_hidden_result": 0,
        "chk_banned_result": 0,
        "lab_report_url": "https://example.com/lab/plaaay-plain.pdf",
        "lab_report_name": "Eurofins",
        "lab_report_date": "2025-11-15",
        "lab_report_summary": "All analytes within Sortd limits.",
    },
    {
        "sortd_sku": "SRT-CHO-PLAAAY-HZ",
        "status": "Live",
        "product_name": "70% Dark Chocolate",
        "variant": "Hazelnut",
        "parent_group": "PLAAAY 70% Dark Chocolate",
        "variation_theme": "Flavour",
        "brand": "PLAAAY",
        "pack_line": "6 bars × 80 g",
        "units_in_pack": 6,
        "aisle": "Chocolate",
        "shelf": "Dark chocolate",
        "label_template": "Chocolate",
        "tags": "dark chocolate, hazelnut, coconut sugar, plaaay",
        "price": 60,
        "stock": 50,
        "max_order": 6,
        "short_desc": "70% cacao dark chocolate with roasted hazelnuts. Sweetened with coconut sugar.",
        "headline": "70% cacao. Six ingredients. Coconut sugar, nothing more.",
        "main_image": "https://example.com/plaaay-hazelnut.jpg",
        "gallery": ", ".join(f"https://example.com/plaaay-hazelnut-gallery-{index}.jpg" for index in range(1, 6)),
        "basis": "Per bar",
        "serving": 80,
        "printed_per": 80,
        "energy_kcal": 488,
        "protein_g": 7.2,
        "carbs_g": 27.4,
        "sugars_g": 16.8,
        "added_sugars_g": 0,
        "fibre_g": 8.4,
        "fat_g": 38.5,
        "saturates_g": 22.1,
        "trans_fat_g": 0,
        "sodium_mg": 88,
        "cacao_pct": 70,
        "lv_sugars_level": "Medium",
        "lv_fat_level": "High",
        "lv_saturates_level": "High",
        "nutrition_note": "Potassium isn't listed on this pack. Levels: UK FSA, per 100 g.",
        "ingredients_full": "Cacao mass, Coconut sugar, Cacao butter, Hazelnuts, Vanilla, Emulsifier (sunflower lecithin)",
        "shares_printed": "Yes",
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
        "allergens": "Tree nuts",
        "may_contain": "Milk, Peanuts",
        "how_to_use": "Break into pieces and enjoy.",
        "chk_hidden_result": 0,
        "chk_banned_result": 0,
    },
    {
        "sortd_sku": "SRT-CHO-PLAAAY-SS",
        "status": "Live",
        "product_name": "70% Dark Chocolate",
        "variant": "Sea Salt",
        "parent_group": "PLAAAY 70% Dark Chocolate",
        "variation_theme": "Flavour",
        "brand": "PLAAAY",
        "pack_line": "6 bars × 80 g",
        "units_in_pack": 6,
        "aisle": "Chocolate",
        "shelf": "Dark chocolate",
        "label_template": "Chocolate",
        "tags": "dark chocolate, sea salt, coconut sugar, plaaay",
        "price": 60,
        "stock": 50,
        "max_order": 6,
        "short_desc": "70% cacao dark chocolate with sea salt. Sweetened with coconut sugar.",
        "headline": "70% cacao. Six ingredients. Coconut sugar, nothing more.",
        "main_image": "https://example.com/plaaay-sea-salt.jpg",
        "gallery": ", ".join(f"https://example.com/plaaay-sea-salt-gallery-{index}.jpg" for index in range(1, 6)),
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
        "sodium_mg": 120,
        "cacao_pct": 70,
        "lv_sugars_level": "Medium",
        "lv_fat_level": "High",
        "lv_saturates_level": "High",
        "nutrition_note": "Potassium isn't listed on this pack. Levels: UK FSA, per 100 g.",
        "ingredients_full": "Cacao mass, Coconut sugar, Cacao butter, Sea salt, Vanilla, Emulsifier (sunflower lecithin)",
        "shares_printed": "Yes",
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
        "allergens": "None declared",
        "may_contain": "Tree nuts, Milk",
        "how_to_use": "Break into pieces and enjoy.",
        "chk_hidden_result": 0,
        "chk_banned_result": 0,
        "lab_report_url": "https://example.com/lab/plaaay-sea-salt.pdf",
        "lab_report_name": "Eurofins",
        "lab_report_date": "2025-11-15",
        "lab_report_summary": "All analytes within Sortd limits.",
    },
)


def _cell(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _blank_row() -> dict[str, Any]:
    return {column.key: "" for column in IMPORT_COLUMNS}


def _normalize_row(raw: dict[str, Any]) -> dict[str, Any]:
    row = _blank_row()
    for key, value in raw.items():
        if key in row and value not in (None, ""):
            row[key] = value
    return row


def parse_source_rows(path: Path) -> list[dict[str, Any]]:
    workbook = load_workbook(path, data_only=True)
    sheet = workbook["Launch range"]
    rows = list(sheet.iter_rows(values_only=True))
    keys = [_cell(value) for value in rows[2]]
    parsed: list[dict[str, Any]] = []
    for values in rows[3:]:
        if not values or all(value in (None, "") for value in values):
            continue
        raw = {keys[index]: values[index] if index < len(values) else None for index in range(len(keys)) if keys[index]}
        sku = _cell(raw.get("sortd_sku"))
        if not sku or not SKU_RE.match(sku):
            continue
        if sku.upper() in REMOVE_SKUS:
            continue
        if any(marker in sku.lower() for marker in INSTRUCTION_MARKERS):
            continue
        parsed.append(_normalize_row(raw))
    workbook.close()
    return parsed


def build_example_row() -> dict[str, Any]:
    row = deepcopy(PLAAAY_FLAVOURS[2])
    row["sortd_sku"] = "SRT-EXAMPLE-001"
    row["status"] = "Not collected"
    row["product_name"] = "Example product (do not import)"
    row["variant"] = "Reference row"
    row["parent_group"] = "Example group"
    row["brand"] = "Example Brand"
    row["pack_line"] = "6 bars × 80 g"
    row["net_qty"] = 480
    row["unit"] = "g"
    row["short_desc"] = "Fill every column like this when a row is ready for Live."
    row["compare_price"] = 72
    row["main_image"] = "https://example.com/products/example-main.jpg"
    row["gallery"] = ", ".join(f"https://example.com/products/example-gallery-{index}.jpg" for index in range(1, 6))
    row["potassium_mg"] = 420
    row["vitamin_e_mg"] = 2.4
    row["mufa_g"] = 12.5
    row["pufa_g"] = 2.1
    row["ing7_name"] = "Example ingredient 7"
    row["ing7_pct"] = 3
    row["ing8_name"] = "Example ingredient 8"
    row["ing8_pct"] = 2
    return row


def highlight_example_row(path: Path, example_sku: str) -> None:
    workbook = load_workbook(path)
    sheet = workbook["Launch range"]
    keys = [sheet.cell(row=3, column=col).value for col in range(1, len(IMPORT_COLUMNS) + 1)]
    sku_index = keys.index("sortd_sku") + 1
    target_row = None
    for row in range(5, sheet.max_row + 1):
        if _cell(sheet.cell(row=row, column=sku_index).value).upper() == example_sku.upper():
            target_row = row
            break
    if target_row is None:
        workbook.close()
        return

    for col in range(1, len(IMPORT_COLUMNS) + 1):
        cell = sheet.cell(row=target_row, column=col)
        cell.fill = EXAMPLE_FILL
        cell.font = EXAMPLE_FONT
        cell.border = THIN_BORDER
    sheet.cell(row=target_row, column=1).comment = None
    workbook.save(path)
    workbook.close()


def update_readme_note(path: Path) -> None:
    workbook = load_workbook(path)
    readme = workbook["Read me"]
    readme.cell(row=12, column=1, value="Example row")
    readme.cell(
        row=12,
        column=2,
        value="The last row (SRT-EXAMPLE-001) is highlighted in yellow. It shows every column filled — use it as a reference, not for import.",
    )
    readme["A12"].font = Font(bold=True)
    workbook.save(path)
    workbook.close()


def resolve_source() -> Path:
    for candidate in (SOURCE, FALLBACK_SOURCE):
        if candidate.exists():
            return candidate
    raise SystemExit(f"Source workbook not found. Expected {SOURCE} or {FALLBACK_SOURCE}")


def main() -> None:
    source = resolve_source()
    rows = parse_source_rows(source)
    rows.append(build_example_row())

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    build_import_workbook_from_rows(rows, OUTPUT)
    highlight_example_row(OUTPUT, "SRT-EXAMPLE-001")
    update_readme_note(OUTPUT)
    shutil.copy2(OUTPUT, DOWNLOADS_COPY)

    product_rows = len(rows) - 1
    print(f"Source: {source}")
    print(f"Wrote {OUTPUT}")
    print(f"  {product_rows} product rows + 1 highlighted example row ({len(rows)} total)")
    print(f"Copied to {DOWNLOADS_COPY}")


if __name__ == "__main__":
    main()
