"""Merge client-filled import rows into the master Sortd import workbook."""

from __future__ import annotations

import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

from catalog.excel_importer import ExcelCatalogImporter
from catalog.import_columns import IMPORT_COLUMN_KEYS

SKU_RE = re.compile(r"^SRT-[A-Z0-9-]+$", re.IGNORECASE)


def _cell(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _is_filled(value: Any) -> bool:
    text = _cell(value)
    if not text:
        return False
    if text.lower() in {"none", "null", "n/a"}:
        return False
    return True


def parse_launch_rows(path: Path) -> list[dict[str, Any]]:
    with path.open("rb") as handle:
        rows = ExcelCatalogImporter().parse_workbook(handle)
    return [row for row in rows if SKU_RE.match(_cell(row.get("sortd_sku")))]


def merge_import_rows(base_rows: list[dict[str, Any]], filled_rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    filled_by_sku = {_cell(row.get("sortd_sku")).upper(): row for row in filled_rows}
    base_by_sku = {_cell(row.get("sortd_sku")).upper(): row for row in base_rows}

    stats = {
        "base_rows": len(base_rows),
        "filled_rows": len(filled_rows),
        "updated_skus": 0,
        "fields_updated": 0,
        "added_skus": 0,
    }

    merged: list[dict[str, Any]] = []
    seen: set[str] = set()

    for base in base_rows:
        sku = _cell(base.get("sortd_sku")).upper()
        if not sku:
            continue
        seen.add(sku)
        out = {key: base.get(key, "") for key in IMPORT_COLUMN_KEYS}
        overlay = filled_by_sku.get(sku)
        if overlay:
            changed = False
            for key in IMPORT_COLUMN_KEYS:
                value = overlay.get(key)
                if _is_filled(value):
                    if _cell(out.get(key)) != _cell(value):
                        stats["fields_updated"] += 1
                        changed = True
                    out[key] = value
            if changed:
                stats["updated_skus"] += 1
        merged.append(out)

    for sku, overlay in filled_by_sku.items():
        if sku in seen:
            continue
        out = {key: "" for key in IMPORT_COLUMN_KEYS}
        for key in IMPORT_COLUMN_KEYS:
            value = overlay.get(key)
            if _is_filled(value):
                out[key] = value
        merged.append(out)
        stats["added_skus"] += 1
        stats["updated_skus"] += 1

    return merged, stats


def backup_workbook(path: Path) -> Path | None:
    if not path.is_file():
        return None
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    backup = path.with_name(f"{path.stem}.backup_{stamp}{path.suffix}")
    shutil.copy2(path, backup)
    return backup
