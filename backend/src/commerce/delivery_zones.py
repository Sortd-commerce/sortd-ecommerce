"""Point-in-polygon helpers for delivery zone coverage."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from commerce.models import DeliveryZone

PolygonRing = list[list[float]]


def _as_float(value: Decimal | float | str | None) -> float | None:
    if value is None:
        return None
    return float(value)


def point_in_polygon(*, latitude: Decimal | float, longitude: Decimal | float, polygon: PolygonRing) -> bool:
    """Return True when (latitude, longitude) lies inside a closed polygon ring."""
    if len(polygon) < 3:
        return False

    lat = _as_float(latitude)
    lng = _as_float(longitude)
    if lat is None or lng is None:
        return False

    inside = False
    count = len(polygon)
    j = count - 1
    for i in range(count):
        yi, xi = float(polygon[i][1]), float(polygon[i][0])
        yj, xj = float(polygon[j][1]), float(polygon[j][0])
        intersects = (yi > lat) != (yj > lat) and lng < (xj - xi) * (lat - yi) / (yj - yi + 1e-15) + xi
        if intersects:
            inside = not inside
        j = i
    return inside


def normalize_polygon_ring(raw: list) -> PolygonRing:
    """Validate and normalize a polygon ring of [lng, lat] pairs."""
    if not isinstance(raw, list) or len(raw) < 3:
        raise ValueError("Polygon must contain at least three coordinate pairs.")

    ring: PolygonRing = []
    for index, point in enumerate(raw):
        if not isinstance(point, (list, tuple)) or len(point) != 2:
            raise ValueError(f"Point {index + 1} must be a [lng, lat] pair.")
        lng = float(point[0])
        lat = float(point[1])
        if not (-180.0 <= lng <= 180.0 and -90.0 <= lat <= 90.0):
            raise ValueError(f"Point {index + 1} has invalid coordinates.")
        ring.append([lng, lat])

    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring


def find_zone_for_coordinates(
    *,
    latitude: Decimal | float | None,
    longitude: Decimal | float | None,
    zones: list[DeliveryZone] | None = None,
) -> DeliveryZone | None:
    from commerce.models import DeliveryZone

    if latitude is None or longitude is None:
        return None

    rows = zones if zones is not None else DeliveryZone.objects.filter(is_active=True).order_by("sort_order", "name")
    for zone in rows:
        if point_in_polygon(latitude=latitude, longitude=longitude, polygon=zone.polygon):
            return zone
    return None
