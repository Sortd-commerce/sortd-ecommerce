from decimal import Decimal

from django.test import SimpleTestCase

from commerce.delivery_zones import find_zone_for_coordinates, normalize_polygon_ring, point_in_polygon
from commerce.models import DeliveryZone


class DeliveryZoneGeometryTests(SimpleTestCase):
    def test_point_in_polygon_detects_inside_and_outside(self):
        ring = normalize_polygon_ring(
            [
                [55.13, 25.07],
                [55.15, 25.07],
                [55.15, 25.09],
                [55.13, 25.09],
            ]
        )
        self.assertTrue(point_in_polygon(latitude=25.0805, longitude=55.1403, polygon=ring))
        self.assertFalse(point_in_polygon(latitude=24.4539, longitude=54.3773, polygon=ring))

    def test_find_zone_for_coordinates_returns_active_match(self):
        zone = DeliveryZone(
            name="Test Marina",
            slug="test-marina",
            polygon=normalize_polygon_ring(
                [
                    [55.13, 25.07],
                    [55.15, 25.07],
                    [55.15, 25.09],
                    [55.13, 25.09],
                ]
            ),
            delivery_fee=Decimal("10.00"),
            is_active=True,
        )
        match = find_zone_for_coordinates(
            latitude=Decimal("25.080500"),
            longitude=Decimal("55.140300"),
            zones=[zone],
        )
        self.assertEqual(match, zone)

        zone.is_active = False
        self.assertIsNone(
            find_zone_for_coordinates(
                latitude=Decimal("25.080500"),
                longitude=Decimal("55.140300"),
                zones=[zone],
            )
        )
