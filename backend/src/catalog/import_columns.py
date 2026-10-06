"""Columns for the client-facing product import workbook."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ImportColumn:
    key: str
    label: str
    section: str
    hint: str = ""
    required: str = "optional"  # always | live | optional


_OPTIONAL_NUTRITION_HINT = "From pack panel. Optional until Live."
_OPTIONAL_INGREDIENT_HINT = "Optional. Only if ingredient shares are known."


IMPORT_COLUMNS: tuple[ImportColumn, ...] = (
    # Identity
    ImportColumn("sortd_sku", "Sortd SKU *", "1 - IDENTITY", "Unique code, e.g. SRT-SNK-021.", "always"),
    ImportColumn("status", "Status *", "1 - IDENTITY", "Pick from the list. Use Live only when the row is complete.", "always"),
    ImportColumn("product_name", "Product name (page title) *", "1 - IDENTITY", "Main title on the product page.", "always"),
    ImportColumn("variant", "Flavour / variant", "1 - IDENTITY", "Appended to title when present, e.g. Coffee Cocoa.", "optional"),
    ImportColumn("parent_group", "Variant group", "1 - IDENTITY", "Same text for every flavour/size in one product group.", "optional"),
    ImportColumn("variation_theme", "Variation type", "1 - IDENTITY", "Flavour, Size, Pack, or Flavour + size.", "optional"),
    ImportColumn("brand", "Brand *", "1 - IDENTITY", "Brand name as written on pack.", "always"),
    ImportColumn("pack_line", "Pack line (under title) *", "1 - IDENTITY", "e.g. 200g jar, Pack of 5. Required before Live.", "live"),
    ImportColumn("net_qty", "Net quantity", "1 - IDENTITY", "Numeric size if pack line is blank.", "optional"),
    ImportColumn("unit", "Unit", "1 - IDENTITY", "g, kg, ml, L, or pcs. See Lists sheet.", "optional"),
    ImportColumn("units_in_pack", "Units in pack", "1 - IDENTITY", "For multi-pack offers, e.g. 5.", "optional"),
    # Placement
    ImportColumn("aisle", "Aisle *", "2 - SHOP PLACEMENT", "Top-level shop aisle. See Lists sheet.", "always"),
    ImportColumn("shelf", "Shelf", "2 - SHOP PLACEMENT", "Sub-aisle label for internal use.", "optional"),
    ImportColumn("label_template", "Label template *", "2 - SHOP PLACEMENT", "Category template for nutrition tiles. See Lists sheet.", "always"),
    ImportColumn("tags", "Diet & claim tags", "2 - SHOP PLACEMENT", "Comma-separated tags for search/filters.", "optional"),
    # Price & stock
    ImportColumn("price", "Selling price (AED) *", "3 - PRICE & STOCK", "Required before Live.", "live"),
    ImportColumn("compare_price", "Compare-at price (AED)", "3 - PRICE & STOCK", "Optional struck-through price.", "optional"),
    ImportColumn("stock", "Stock on hand", "3 - PRICE & STOCK", "Units available to sell.", "optional"),
    ImportColumn("max_order", "Max per order", "3 - PRICE & STOCK", "Optional purchase limit.", "optional"),
    # Page content
    ImportColumn("short_desc", "Short description *", "4 - PAGE CONTENT", "Product page copy. Required before Live.", "live"),
    ImportColumn("headline", "Label headline *", "4 - PAGE CONTENT", "Headline in the label-checked section.", "live"),
    ImportColumn(
        "main_image",
        "Main image URL *",
        "4 - PAGE CONTENT",
        "Public https link, or a path relative to the workbook folder. Google Drive links work. Required before Live.",
        "live",
    ),
    ImportColumn(
        "gallery",
        "Gallery image URLs",
        "4 - PAGE CONTENT",
        "Comma-separated public https links or paths relative to the workbook folder.",
        "optional",
    ),
    ImportColumn("how_to_use", "How to use", "4 - PAGE CONTENT", "Optional guidance shown in the label section.", "optional"),
    # Nutrition
    ImportColumn("basis", "Label basis *", "5 - NUTRITION", "e.g. Per 100g. Required before Live.", "live"),
    ImportColumn("serving", "Serving size (g or ml) *", "5 - NUTRITION", "As printed on pack.", "live"),
    ImportColumn("printed_per", "Panel printed per (g or ml) *", "5 - NUTRITION", "Reference amount on nutrition panel.", "live"),
    ImportColumn("energy_kcal", "Energy (kcal)", "5 - NUTRITION", _OPTIONAL_NUTRITION_HINT, "optional"),
    ImportColumn("protein_g", "Protein (g)", "5 - NUTRITION", _OPTIONAL_NUTRITION_HINT, "optional"),
    ImportColumn("carbs_g", "Carbohydrate (g)", "5 - NUTRITION", _OPTIONAL_NUTRITION_HINT, "optional"),
    ImportColumn("sugars_g", "Total sugars (g)", "5 - NUTRITION", _OPTIONAL_NUTRITION_HINT, "optional"),
    ImportColumn("added_sugars_g", "Added sugars (g)", "5 - NUTRITION", _OPTIONAL_NUTRITION_HINT, "optional"),
    ImportColumn("fibre_g", "Fibre (g)", "5 - NUTRITION", _OPTIONAL_NUTRITION_HINT, "optional"),
    ImportColumn("fat_g", "Fat (g)", "5 - NUTRITION", _OPTIONAL_NUTRITION_HINT, "optional"),
    ImportColumn("saturates_g", "Saturates (g)", "5 - NUTRITION", _OPTIONAL_NUTRITION_HINT, "optional"),
    ImportColumn("trans_fat_g", "Trans fat (g)", "5 - NUTRITION", _OPTIONAL_NUTRITION_HINT, "optional"),
    ImportColumn("cholesterol_mg", "Cholesterol (mg)", "5 - NUTRITION", _OPTIONAL_NUTRITION_HINT, "optional"),
    ImportColumn("sodium_mg", "Sodium (mg)", "5 - NUTRITION", _OPTIONAL_NUTRITION_HINT, "optional"),
    ImportColumn("potassium_mg", "Potassium (mg)", "5 - NUTRITION", _OPTIONAL_NUTRITION_HINT, "optional"),
    ImportColumn("vitamin_e_mg", "Vitamin E (mg)", "5 - NUTRITION", _OPTIONAL_NUTRITION_HINT, "optional"),
    ImportColumn("cacao_pct", "Cacao / cocoa solids (%)", "5 - NUTRITION", _OPTIONAL_NUTRITION_HINT, "optional"),
    ImportColumn("mufa_g", "MUFA (g)", "5 - NUTRITION", _OPTIONAL_NUTRITION_HINT, "optional"),
    ImportColumn("pufa_g", "PUFA (g)", "5 - NUTRITION", _OPTIONAL_NUTRITION_HINT, "optional"),
    ImportColumn("nutrition_note", "Nutrition note", "5 - NUTRITION", "Optional note shown on the label section.", "optional"),
    ImportColumn("lv_sugars_level", "Sugars traffic light", "5 - NUTRITION", "Low, Medium, or High.", "optional"),
    ImportColumn("lv_fat_level", "Fat traffic light", "5 - NUTRITION", "Low, Medium, or High.", "optional"),
    ImportColumn("lv_saturates_level", "Saturates traffic light", "5 - NUTRITION", "Low, Medium, or High.", "optional"),
    # Ingredients & allergens
    ImportColumn(
        "ingredients_full",
        "Ingredients (as printed) *",
        "6 - INGREDIENTS & ALLERGENS",
        "Full ingredient list from pack. Required before Live.",
        "live",
    ),
    ImportColumn("shares_printed", "Shares printed on pack? *", "6 - INGREDIENTS & ALLERGENS", "Yes or No.", "live"),
    ImportColumn("ing1_name", "Ingredient 1", "6 - INGREDIENTS & ALLERGENS", _OPTIONAL_INGREDIENT_HINT, "optional"),
    ImportColumn("ing1_pct", "Ingredient 1 %", "6 - INGREDIENTS & ALLERGENS", "Optional percentage.", "optional"),
    ImportColumn("ing2_name", "Ingredient 2", "6 - INGREDIENTS & ALLERGENS", _OPTIONAL_INGREDIENT_HINT, "optional"),
    ImportColumn("ing2_pct", "Ingredient 2 %", "6 - INGREDIENTS & ALLERGENS", "Optional percentage.", "optional"),
    ImportColumn("ing3_name", "Ingredient 3", "6 - INGREDIENTS & ALLERGENS", _OPTIONAL_INGREDIENT_HINT, "optional"),
    ImportColumn("ing3_pct", "Ingredient 3 %", "6 - INGREDIENTS & ALLERGENS", "Optional percentage.", "optional"),
    ImportColumn("ing4_name", "Ingredient 4", "6 - INGREDIENTS & ALLERGENS", _OPTIONAL_INGREDIENT_HINT, "optional"),
    ImportColumn("ing4_pct", "Ingredient 4 %", "6 - INGREDIENTS & ALLERGENS", "Optional percentage.", "optional"),
    ImportColumn("ing5_name", "Ingredient 5", "6 - INGREDIENTS & ALLERGENS", _OPTIONAL_INGREDIENT_HINT, "optional"),
    ImportColumn("ing5_pct", "Ingredient 5 %", "6 - INGREDIENTS & ALLERGENS", "Optional percentage.", "optional"),
    ImportColumn("ing6_name", "Ingredient 6", "6 - INGREDIENTS & ALLERGENS", _OPTIONAL_INGREDIENT_HINT, "optional"),
    ImportColumn("ing6_pct", "Ingredient 6 %", "6 - INGREDIENTS & ALLERGENS", "Optional percentage.", "optional"),
    ImportColumn("ing7_name", "Ingredient 7", "6 - INGREDIENTS & ALLERGENS", _OPTIONAL_INGREDIENT_HINT, "optional"),
    ImportColumn("ing7_pct", "Ingredient 7 %", "6 - INGREDIENTS & ALLERGENS", "Optional percentage.", "optional"),
    ImportColumn("ing8_name", "Ingredient 8", "6 - INGREDIENTS & ALLERGENS", _OPTIONAL_INGREDIENT_HINT, "optional"),
    ImportColumn("ing8_pct", "Ingredient 8 %", "6 - INGREDIENTS & ALLERGENS", "Optional percentage.", "optional"),
    ImportColumn("ingredient_note", "Ingredient note", "6 - INGREDIENTS & ALLERGENS", "Optional internal note.", "optional"),
    ImportColumn("allergens", "Contains (allergens) *", "6 - INGREDIENTS & ALLERGENS", "Comma-separated. See Lists sheet.", "live"),
    ImportColumn("may_contain", "May contain", "6 - INGREDIENTS & ALLERGENS", "Cross-contamination statement.", "optional"),
    ImportColumn("chk_hidden_result", "Hidden sugars found", "6 - INGREDIENTS & ALLERGENS", "Count found, or 0.", "optional"),
    ImportColumn("chk_banned_result", "Banned ingredients found", "6 - INGREDIENTS & ALLERGENS", "Count found, or 0.", "optional"),
    # Lab report
    ImportColumn(
        "lab_report_url",
        "Lab report PDF URL",
        "7 - LAB REPORT",
        "Optional public https link to the lab PDF. Google Drive links work.",
        "optional",
    ),
    ImportColumn("lab_report_name", "Lab name", "7 - LAB REPORT", "Optional. Defaults to Lab report.", "optional"),
    ImportColumn("lab_report_date", "Report date", "7 - LAB REPORT", "Optional. YYYY-MM-DD.", "optional"),
    ImportColumn("lab_report_summary", "Report summary", "7 - LAB REPORT", "Optional one-line summary.", "optional"),
)

IMPORT_COLUMN_KEYS: frozenset[str] = frozenset(column.key for column in IMPORT_COLUMNS)

LIST_VALUES = {
    "Status": ["Draft", "Needs pack data", "Needs price", "Ready for review", "Live", "Paused", "Not collected"],
    "Aisle": ["Breakfast & spreads", "Snacks & bars", "Chocolate", "Drinks", "Pantry"],
    "Template": [
        "Protein & snack bars",
        "Savoury snacks",
        "Cooking oils",
        "Drinks & juices",
        "Chocolate",
        "Pulses, flour & pasta",
        "Nut butters & spreads",
        "Breakfast & oats",
        "Sauces & condiments",
    ],
    "Unit": ["g", "kg", "ml", "L", "pcs"],
    "Variation": ["Flavour", "Size", "Pack", "Flavour + size"],
    "Yesno": ["Yes", "No"],
    "Allergen": [
        "Cereals with gluten",
        "Crustaceans",
        "Eggs",
        "Fish",
        "Peanuts",
        "Soybeans",
        "Milk",
        "Tree nuts",
        "Celery",
        "Mustard",
        "Sesame",
        "Sulphites",
        "Lupin",
        "Molluscs",
        "None declared",
    ],
}
