from django.db.models import Q

from catalog.models import Category
from catalog.queries import active_products_list
from catalog.schemas import category_image_url, image_url


def search_suggestions(query: str, *, limit: int = 3) -> list[dict]:
    term = (query or "").strip()
    if len(term) < 2:
        return []

    limit = max(1, min(limit, 8))
    rows: list[dict] = []

    categories = list(
        Category.objects.filter(is_active=True, name__icontains=term).order_by("sort_order", "name")[:1]
    )
    for category in categories:
        rows.append(
            {
                "kind": "category",
                "label": category.name,
                "slug": category.slug,
                "brand": None,
                "image_url": category_image_url(category) or None,
            }
        )

    product_limit = max(limit - len(rows), 0)
    if product_limit:
        products = (
            active_products_list()
            .filter(
                Q(title__icontains=term)
                | Q(brand__icontains=term)
                | Q(tags__icontains=term)
                | Q(category__name__icontains=term)
                | Q(shelf__icontains=term)
            )
            .order_by("title")[:product_limit]
        )
        for product in products:
            images = list(product.images.all())
            primary = images[0] if images else None
            rows.append(
                {
                    "kind": "product",
                    "label": product.title,
                    "slug": product.slug,
                    "brand": product.brand or None,
                    "image_url": image_url(primary) if primary else None,
                    "category_slug": product.category.slug,
                }
            )

    return rows[:limit]
