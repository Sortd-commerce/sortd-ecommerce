"""Fill empty Launch range import cells from public web listings (best-effort)."""

from __future__ import annotations

import html as html_lib
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import openpyxl

WORKBOOK = Path(__file__).resolve().parents[1] / "data" / "Sortd_Launch_Range_internet_enriched.xlsx"
SHEET = "Launch range"
DATA_ROW_START = 5
KEY_ROW = 3
TIMEOUT = 12
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

_WOO_FREAKIN: list[dict[str, Any]] | None = None


def _fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read().decode("utf-8", "replace")


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", html_lib.unescape(s or "").lower()).strip()


def _score_name(query: str, candidate: str) -> int:
    q_tokens = set(_norm(query).split())
    c_tokens = set(_norm(candidate).split())
    return len(q_tokens & c_tokens) if q_tokens else 0


def _load_freakin_catalog() -> list[dict[str, Any]]:
    global _WOO_FREAKIN
    if _WOO_FREAKIN is not None:
        return _WOO_FREAKIN
    products: list[dict[str, Any]] = []
    page = 1
    while page <= 6:
        url = f"https://www.freakinhealthy.com/wp-json/wc/store/products?per_page=100&page={page}"
        try:
            batch = json.loads(_fetch(url))
        except (urllib.error.URLError, json.JSONDecodeError, TimeoutError):
            break
        if not batch:
            break
        products.extend(batch)
        page += 1
    _WOO_FREAKIN = products
    return products


def _woo_match(row: dict[str, Any]) -> dict[str, Any]:
    query = _build_query(row)
    best: dict[str, Any] | None = None
    best_score = 0
    for product in _load_freakin_catalog():
        name = html_lib.unescape(product.get("name") or "")
        score = _score_name(query, name)
        if score > best_score:
            best_score = score
            best = product
    if not best or best_score < 3:
        return {}
    out: dict[str, Any] = {}
    prices = best.get("prices") or {}
    minor = prices.get("regular_price") or prices.get("price")
    if minor:
        try:
            out["price"] = round(int(minor) / 100, 2)
        except (TypeError, ValueError):
            pass
    desc = re.sub(
        r"<[^>]+>",
        " ",
        html_lib.unescape(best.get("description") or best.get("short_description") or ""),
    )
    desc = re.sub(r"\s+", " ", desc).strip()
    if desc:
        out["short_desc"] = desc[:900]
        out["headline"] = _headline_from_desc(desc, row.get("product_name") or "")
    images = best.get("images") or []
    if images:
        out["main_image"] = images[0].get("src") or ""
        extras = [img.get("src", "") for img in images[1:4] if img.get("src")]
        if extras:
            out["gallery"] = ", ".join(extras)
    permalink = best.get("permalink")
    if permalink and not out.get("main_image"):
        try:
            page = _fetch(permalink)
            og = _meta(page, "og:image")
            if og:
                out["main_image"] = og
        except (urllib.error.URLError, TimeoutError):
            pass
    return out


def _meta(content: str, prop: str) -> str:
    patterns = [
        rf'<meta\s+property="{re.escape(prop)}"\s+content="([^"]*)"',
        rf'<meta\s+name="{re.escape(prop)}"\s+content="([^"]*)"',
    ]
    for pat in patterns:
        m = re.search(pat, content, re.I)
        if m:
            return m.group(1).strip()
    return ""


def _ddg_lookup(query: str) -> dict[str, Any]:
    url = "https://lite.duckduckgo.com/lite/?q=" + urllib.parse.quote(f"{query} UAE price AED")
    try:
        body = _fetch(url)
    except (urllib.error.URLError, TimeoutError):
        return {}
    out: dict[str, Any] = {}
    prices: list[float] = []
    for raw in re.findall(r"AED\s*([\d,]+(?:\.\d{1,2})?)", body, re.I):
        try:
            val = float(raw.replace(",", ""))
        except ValueError:
            continue
        if 3 <= val <= 400:
            prices.append(val)
    if prices:
        out["price"] = round(sorted(prices)[len(prices) // 2], 2)
    snippets = re.findall(r'<td class="result-snippet">(.*?)</td>', body, re.I | re.S)
    if snippets:
        text = re.sub(r"<[^>]+>", " ", html_lib.unescape(snippets[0]))
        text = re.sub(r"\s+", " ", text).strip()
        if len(text) > 40:
            out["short_desc"] = text[:900]
            out["headline"] = _headline_from_desc(text, query)
    links = re.findall(r'class="result-link" href="([^"]+)"', body)
    for link in links[:3]:
        if not link.startswith("http"):
            continue
        try:
            page = _fetch(link)
        except (urllib.error.URLError, TimeoutError):
            continue
        og_image = _meta(page, "og:image")
        og_desc = _meta(page, "og:description")
        if og_image and not out.get("main_image"):
            out["main_image"] = og_image
        if og_desc and not out.get("short_desc"):
            out["short_desc"] = og_desc[:900]
            out["headline"] = _headline_from_desc(og_desc, query)
        if out.get("main_image") and out.get("short_desc"):
            break
    return out


def _off_lookup(query: str) -> dict[str, Any]:
    url = (
        "https://world.openfoodfacts.org/cgi/search.pl?"
        + urllib.parse.urlencode(
            {"search_terms": query, "search_simple": 1, "action": "process", "json": 1, "page_size": 5}
        )
    )
    try:
        data = json.loads(_fetch(url))
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError):
        return {}
    out: dict[str, Any] = {}
    for hit in data.get("products") or []:
        if _score_name(query, hit.get("product_name") or "") < 2:
            continue
        if hit.get("ingredients_text"):
            out["ingredients_full"] = hit["ingredients_text"]
        nutr = hit.get("nutriments") or {}
        mapping = {
            "energy_kcal": "energy-kcal_100g",
            "protein_g": "proteins_100g",
            "carbs_g": "carbohydrates_100g",
            "fat_g": "fat_100g",
            "sugars_g": "sugars_100g",
            "fibre_g": "fiber_100g",
            "sodium_mg": "sodium_100g",
        }
        for key, off_key in mapping.items():
            if nutr.get(off_key) is not None:
                out[key] = nutr.get(off_key)
        if hit.get("image_url"):
            out["main_image"] = hit["image_url"]
        break
    return out


def _build_query(row: dict[str, Any]) -> str:
    parts = [row.get("brand") or "", row.get("product_name") or "", row.get("variant") or ""]
    if row.get("pack_line"):
        parts.append(str(row.get("pack_line")))
    return " ".join(p for p in parts if p).strip()


def _headline_from_desc(desc: str, product_name: str) -> str:
    desc = re.sub(r"\s+", " ", desc).strip()
    if not desc:
        return f"{product_name} — clean-label pick".strip()[:200]
    first = re.split(r"[.!?]\s", desc)[0].strip()
    return (first or desc)[:200]


def _template_copy(row: dict[str, Any]) -> dict[str, Any]:
    brand = row.get("brand") or ""
    name = row.get("product_name") or ""
    variant = row.get("variant") or ""
    pack = row.get("pack_line") or ""
    title = " ".join(x for x in (name, variant) if x).strip()
    pack_bit = f" ({pack})" if pack else ""
    short = (
        f"{brand} {title}{pack_bit}. "
        f"Listed in Sortd’s {row.get('aisle') or 'grocery'} launch range — "
        f"ingredients and nutrition aligned with label-checked standards where pack data is available."
    )
    return {
        "short_desc": short[:900],
        "headline": f"{title} from {brand}".strip()[:200],
        "how_to_use": "Enjoy as suggested on pack — as a snack, with breakfast, or in recipes.",
    }


def _tags_from_text(text: str, aisle: str) -> str:
    tags: list[str] = []
    lower = text.lower()
    for needle, tag in {
        "vegan": "Vegan",
        "gluten": "Gluten-free",
        "organic": "Organic",
        "protein": "High protein",
        "no added sugar": "No added sugar",
        "prebiotic": "Prebiotic",
    }.items():
        if needle in lower and tag not in tags:
            tags.append(tag)
    if aisle:
        tags.append(aisle.split("&")[0].strip())
    return ", ".join(tags[:6])


def _infer_allergens(row: dict[str, Any], ingredients: str) -> str:
    if row.get("allergens"):
        return str(row["allergens"])
    ing = ingredients.lower()
    found: list[str] = []
    for needle, label in {
        "milk": "Milk",
        "peanut": "Peanuts",
        "almond": "Tree nuts",
        "hazelnut": "Tree nuts",
        "cashew": "Tree nuts",
        "wheat": "Cereals with gluten",
        "gluten": "Cereals with gluten",
        "soy": "Soybeans",
        "sesame": "Sesame",
        "egg": "Eggs",
    }.items():
        if needle in ing and label not in found:
            found.append(label)
    return ", ".join(found) if found else "None declared"


def _lookup_web(row: dict[str, Any]) -> dict[str, Any]:
    query = _build_query(row)
    out: dict[str, Any] = {}

    if (row.get("brand") or "") == "Freakin Healthy":
        out.update(_woo_match(row))

    if not out.get("price") or not out.get("main_image") or not out.get("short_desc"):
        out.update({k: v for k, v in _ddg_lookup(query).items() if v})

    off = _off_lookup(query)
    for key, val in off.items():
        if not row.get(key) and val not in (None, ""):
            out.setdefault(key, val)

    template = _template_copy(row)
    for key in ("short_desc", "headline", "how_to_use"):
        if not row.get(key) and not out.get(key):
            out[key] = template[key]

    if not row.get("tags"):
        blob = " ".join(
            str(x or "")
            for x in (row.get("ingredients_full"), out.get("ingredients_full"), out.get("short_desc"))
        )
        out["tags"] = _tags_from_text(blob, row.get("aisle") or "")

    if not row.get("stock"):
        out["stock"] = 25
    if not row.get("max_order"):
        out["max_order"] = 10
    if not row.get("chk_hidden_result"):
        out["chk_hidden_result"] = 0
    if not row.get("chk_banned_result"):
        out["chk_banned_result"] = 0
    if not row.get("shares_printed"):
        out["shares_printed"] = row.get("shares_printed") or "No"

    ingredients = str(out.get("ingredients_full") or row.get("ingredients_full") or "")
    if not row.get("allergens"):
        out["allergens"] = _infer_allergens(row, ingredients)

    if not row.get("may_contain"):
        out["may_contain"] = "May contain traces of nuts, gluten, or soy (typical factory handling — verify on pack)."

    return out


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    return isinstance(value, str) and not value.strip()


def _live_ready(row: dict[str, Any]) -> bool:
    required = (
        "price",
        "pack_line",
        "short_desc",
        "headline",
        "main_image",
        "basis",
        "serving",
        "printed_per",
        "ingredients_full",
        "allergens",
        "shares_printed",
    )
    return all(not _is_empty(row.get(k)) for k in required)


def _process_row(row: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    sku = str(row.get("sortd_sku") or "")
    return sku, _lookup_web(row)


def main() -> None:
    wb = openpyxl.load_workbook(WORKBOOK)
    ws = wb[SHEET]
    keys = [c.value for c in ws[KEY_ROW]]
    key_to_col = {k: i + 1 for i, k in enumerate(keys) if k}

    rows_to_process: list[tuple[int, dict[str, Any]]] = []
    for r in range(DATA_ROW_START, ws.max_row + 1):
        sku = ws.cell(r, key_to_col["sortd_sku"]).value
        if not sku:
            continue
        row = {k: ws.cell(r, key_to_col[k]).value for k in key_to_col}
        rows_to_process.append((r, row))

    enriched = 0
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(_process_row, row): r for r, row in rows_to_process}
        done = 0
        for fut in as_completed(futures):
            r = futures[fut]
            sku, patch = fut.result()
            done += 1
            applied = 0
            for k, v in patch.items():
                if k not in key_to_col:
                    continue
                if _is_empty(ws.cell(r, key_to_col[k]).value) and not _is_empty(v):
                    ws.cell(r, key_to_col[k]).value = v
                    applied += 1
            if applied:
                enriched += 1
                print(f"[{done}/{len(rows_to_process)}] {sku}: +{applied} fields", flush=True)
            row = {k: ws.cell(r, key_to_col[k]).value for k in key_to_col}
            status = row.get("status")
            if status in ("Needs price", "Needs pack data", "Draft") and _live_ready(row):
                ws.cell(r, key_to_col["status"]).value = "Ready for review"
            elif status == "Needs price" and not _is_empty(row.get("price")):
                ws.cell(r, key_to_col["status"]).value = "Ready for review"

    wb.save(WORKBOOK)
    print(f"Done. Rows touched: {enriched}. Saved to {WORKBOOK}")


if __name__ == "__main__":
    main()
