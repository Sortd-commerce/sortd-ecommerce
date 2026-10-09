"""HTTP caching for public, cache-safe API responses."""

from django.http import HttpResponse

# Matches storefront product page `revalidate: 60` (browser + shared caches).
PRODUCT_DETAIL_CACHE_CONTROL = (
    "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
)


def apply_product_detail_cache(response: HttpResponse) -> HttpResponse:
    response["Cache-Control"] = PRODUCT_DETAIL_CACHE_CONTROL
    response.setdefault("Vary", "Accept-Encoding")
    return response
