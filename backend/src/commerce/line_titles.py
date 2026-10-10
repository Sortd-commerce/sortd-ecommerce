def display_item_title(product_title: str, variant_title: str = "") -> str:
    name = (product_title or "").strip() or "Item"
    variant = (variant_title or "").strip()
    if not variant or variant.lower() == "default":
        return name
    if variant.lower() in name.lower():
        return name
    return f"{name} · {variant}"


def order_line_display_title(line) -> str:
    variant = getattr(line, "variant", None)
    if variant is None:
        return (getattr(line, "title", None) or "Item").strip() or "Item"
    product = getattr(variant, "product", None)
    product_title = getattr(product, "title", "") if product is not None else ""
    return display_item_title(product_title or line.title, variant.title)
