"""Reference delivery zones. Polygons are approximate bounding areas."""

from decimal import Decimal


def _bbox(*, lng: float, lat: float, d_lng: float = 0.018, d_lat: float = 0.018) -> list[list[float]]:
    return [
        [lng - d_lng, lat - d_lat],
        [lng + d_lng, lat - d_lat],
        [lng + d_lng, lat + d_lat],
        [lng - d_lng, lat + d_lat],
        [lng - d_lng, lat - d_lat],
    ]


REFERENCE_DELIVERY_ZONES: list[dict] = [
    {
        "name": "Jumeirah Lakes Towers",
        "slug": "jlt",
        "sort_order": 10,
        "delivery_fee": Decimal("10.00"),
        "polygon": _bbox(lng=55.1410, lat=25.0697),
    },
]
