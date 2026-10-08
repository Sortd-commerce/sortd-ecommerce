"""Reference delivery zones for Dubai. Polygons are approximate bounding areas."""

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
    {"name": "Dubai Marina", "slug": "dubai-marina", "sort_order": 10, "delivery_fee": Decimal("10.00"), "polygon": _bbox(lng=55.1403, lat=25.0805)},
    {"name": "JBR", "slug": "jbr", "sort_order": 20, "delivery_fee": Decimal("10.00"), "polygon": _bbox(lng=55.1334, lat=25.0772)},
    {"name": "JLT", "slug": "jlt", "sort_order": 30, "delivery_fee": Decimal("10.00"), "polygon": _bbox(lng=55.1410, lat=25.0697)},
    {"name": "JVC", "slug": "jvc", "sort_order": 40, "delivery_fee": Decimal("15.00"), "polygon": _bbox(lng=55.2050, lat=25.0600, d_lng=0.022, d_lat=0.022)},
    {"name": "Business Bay", "slug": "business-bay", "sort_order": 50, "delivery_fee": Decimal("10.00"), "polygon": _bbox(lng=55.2650, lat=25.1850)},
    {"name": "Downtown Dubai", "slug": "downtown-dubai", "sort_order": 60, "delivery_fee": Decimal("10.00"), "polygon": _bbox(lng=55.2744, lat=25.1972)},
    {"name": "DIFC", "slug": "difc", "sort_order": 70, "delivery_fee": Decimal("10.00"), "polygon": _bbox(lng=55.2820, lat=25.2138, d_lng=0.012, d_lat=0.012)},
    {"name": "Palm Jumeirah", "slug": "palm-jumeirah", "sort_order": 80, "delivery_fee": Decimal("12.00"), "polygon": _bbox(lng=55.1390, lat=25.1124, d_lng=0.025, d_lat=0.02)},
    {"name": "Jumeirah", "slug": "jumeirah", "sort_order": 90, "delivery_fee": Decimal("12.00"), "polygon": _bbox(lng=55.2600, lat=25.2300, d_lng=0.025, d_lat=0.02)},
    {"name": "Al Barsha", "slug": "al-barsha", "sort_order": 100, "delivery_fee": Decimal("12.00"), "polygon": _bbox(lng=55.2000, lat=25.1100, d_lng=0.022, d_lat=0.022)},
    {"name": "Dubai Hills", "slug": "dubai-hills", "sort_order": 110, "delivery_fee": Decimal("12.00"), "polygon": _bbox(lng=55.2450, lat=25.1050, d_lng=0.025, d_lat=0.022)},
    {"name": "Arabian Ranches", "slug": "arabian-ranches", "sort_order": 120, "delivery_fee": Decimal("15.00"), "polygon": _bbox(lng=55.2700, lat=25.0550, d_lng=0.025, d_lat=0.022)},
    {"name": "Motor City", "slug": "motor-city", "sort_order": 130, "delivery_fee": Decimal("15.00"), "polygon": _bbox(lng=55.2300, lat=25.0450, d_lng=0.018, d_lat=0.018)},
    {"name": "Sports City", "slug": "sports-city", "sort_order": 140, "delivery_fee": Decimal("15.00"), "polygon": _bbox(lng=55.2200, lat=25.0350, d_lng=0.018, d_lat=0.018)},
    {"name": "Deira", "slug": "deira", "sort_order": 150, "delivery_fee": Decimal("10.00"), "polygon": _bbox(lng=55.3200, lat=25.2700, d_lng=0.025, d_lat=0.022)},
    {"name": "Bur Dubai", "slug": "bur-dubai", "sort_order": 160, "delivery_fee": Decimal("10.00"), "polygon": _bbox(lng=55.2900, lat=25.2600, d_lng=0.022, d_lat=0.022)},
    {"name": "Mirdif", "slug": "mirdif", "sort_order": 170, "delivery_fee": Decimal("15.00"), "polygon": _bbox(lng=55.4200, lat=25.2200, d_lng=0.025, d_lat=0.022)},
    {"name": "Silicon Oasis", "slug": "silicon-oasis", "sort_order": 180, "delivery_fee": Decimal("15.00"), "polygon": _bbox(lng=55.3800, lat=25.1200, d_lng=0.025, d_lat=0.022)},
    {"name": "International City", "slug": "international-city", "sort_order": 190, "delivery_fee": Decimal("15.00"), "polygon": _bbox(lng=55.4100, lat=25.1600, d_lng=0.025, d_lat=0.022)},
    {"name": "Discovery Gardens", "slug": "discovery-gardens", "sort_order": 200, "delivery_fee": Decimal("12.00"), "polygon": _bbox(lng=55.1500, lat=25.0350, d_lng=0.02, d_lat=0.018)},
    {"name": "Barsha Heights", "slug": "barsha-heights", "sort_order": 210, "delivery_fee": Decimal("12.00"), "polygon": _bbox(lng=55.1750, lat=25.0950, d_lng=0.018, d_lat=0.018)},
    {"name": "Al Quoz", "slug": "al-quoz", "sort_order": 220, "delivery_fee": Decimal("12.00"), "polygon": _bbox(lng=55.2300, lat=25.1350, d_lng=0.025, d_lat=0.022)},
    {"name": "Dubai South", "slug": "dubai-south", "sort_order": 230, "delivery_fee": Decimal("15.00"), "polygon": _bbox(lng=55.1600, lat=24.9000, d_lng=0.04, d_lat=0.035)},
    {"name": "The Greens", "slug": "the-greens", "sort_order": 240, "delivery_fee": Decimal("12.00"), "polygon": _bbox(lng=55.1700, lat=25.0950, d_lng=0.015, d_lat=0.015)},
    {"name": "The Meadows", "slug": "the-meadows", "sort_order": 250, "delivery_fee": Decimal("12.00"), "polygon": _bbox(lng=55.1750, lat=25.0700, d_lng=0.015, d_lat=0.015)},
    {"name": "The Springs", "slug": "the-springs", "sort_order": 260, "delivery_fee": Decimal("12.00"), "polygon": _bbox(lng=55.1900, lat=25.0600, d_lng=0.015, d_lat=0.015)},
    {"name": "Emirates Hills", "slug": "emirates-hills", "sort_order": 270, "delivery_fee": Decimal("12.00"), "polygon": _bbox(lng=55.1650, lat=25.0650, d_lng=0.018, d_lat=0.018)},
    {"name": "Nad Al Sheba", "slug": "nad-al-sheba", "sort_order": 280, "delivery_fee": Decimal("15.00"), "polygon": _bbox(lng=55.3500, lat=25.1500, d_lng=0.025, d_lat=0.022)},
    {"name": "City Walk", "slug": "city-walk", "sort_order": 290, "delivery_fee": Decimal("10.00"), "polygon": _bbox(lng=55.2600, lat=25.2050, d_lng=0.012, d_lat=0.012)},
    {"name": "Za'abeel", "slug": "zaabeel", "sort_order": 300, "delivery_fee": Decimal("10.00"), "polygon": _bbox(lng=55.2800, lat=25.2200, d_lng=0.015, d_lat=0.015)},
]
