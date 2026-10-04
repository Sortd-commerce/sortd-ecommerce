from decimal import Decimal
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from commerce.places.closed import ClosedProvider
from commerce.places.factory import build_places_provider
from commerce.places.fixture import FixtureProvider
from commerce.places.google import GoogleProvider
from commerce.places.locationiq import LocationIQProvider


class PlacesFactoryTests(SimpleTestCase):
    @override_settings(
        GEOCODER_PROVIDER="",
        LOCATIONIQ_API_KEY="",
        GOOGLE_MAPS_API_KEY="",
        ENVIRONMENT="local",
    )
    def test_defaults_to_fixture_in_local_without_keys(self):
        self.assertIsInstance(build_places_provider(), FixtureProvider)

    @override_settings(
        GEOCODER_PROVIDER="",
        LOCATIONIQ_API_KEY="pk-test",
        GOOGLE_MAPS_API_KEY="g-test",
        ENVIRONMENT="production",
    )
    def test_prefers_locationiq_when_key_set(self):
        self.assertIsInstance(build_places_provider(), LocationIQProvider)

    @override_settings(
        GEOCODER_PROVIDER="",
        LOCATIONIQ_API_KEY="",
        GOOGLE_MAPS_API_KEY="g-test",
        ENVIRONMENT="production",
    )
    def test_falls_back_to_google_when_only_google_key(self):
        self.assertIsInstance(build_places_provider(), GoogleProvider)

    @override_settings(
        GEOCODER_PROVIDER="google",
        LOCATIONIQ_API_KEY="pk-test",
        GOOGLE_MAPS_API_KEY="g-test",
        ENVIRONMENT="production",
    )
    def test_override_selects_google(self):
        self.assertIsInstance(build_places_provider(), GoogleProvider)

    @override_settings(
        GEOCODER_PROVIDER="fixture",
        LOCATIONIQ_API_KEY="pk-test",
        GOOGLE_MAPS_API_KEY="g-test",
        ENVIRONMENT="production",
    )
    def test_override_selects_fixture(self):
        self.assertIsInstance(build_places_provider(), FixtureProvider)

    @override_settings(
        GEOCODER_PROVIDER="",
        LOCATIONIQ_API_KEY="",
        GOOGLE_MAPS_API_KEY="",
        ENVIRONMENT="production",
    )
    def test_closed_in_production_without_keys(self):
        self.assertIsInstance(build_places_provider(), ClosedProvider)


class FixtureProviderTests(SimpleTestCase):
    def setUp(self):
        self.provider = FixtureProvider()

    def test_autocomplete_matches_fixture_labels(self):
        rows = self.provider.autocomplete(query="marina")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].place_id, "fixture-dubai-marina")

    def test_reverse_geocode_near_marina(self):
        result = self.provider.geocode(latitude=Decimal("25.0805"), longitude=Decimal("55.1403"))
        self.assertEqual(result.status, "OK")
        self.assertEqual(result.place_id, "fixture-dubai-marina")
        self.assertEqual(result.postal_code, "00000")


class LocationIQProviderTests(SimpleTestCase):
    @override_settings(
        LOCATIONIQ_API_KEY="pk-test",
        LOCATIONIQ_AUTOCOMPLETE_URL="https://example.test/autocomplete",
        LOCATIONIQ_SEARCH_URL="https://example.test/search",
        LOCATIONIQ_REVERSE_URL="https://example.test/reverse",
        LOCATIONIQ_LOOKUP_URL="https://example.test/lookup",
    )
    @patch("commerce.places.locationiq.get_json")
    def test_autocomplete_normalizes_osm_place_id(self, get_json):
        get_json.return_value = [
            {
                "place_id": "999",
                "osm_type": "way",
                "osm_id": "123",
                "lat": "25.08",
                "lon": "55.14",
                "display_name": "Dubai Marina, Dubai, UAE",
                "address": {"postcode": "00000", "city": "Dubai"},
            }
        ]
        provider = LocationIQProvider()
        rows = provider.autocomplete(query="marina")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].place_id, "W123")
        self.assertEqual(rows[0].label, "Dubai Marina, Dubai, UAE")

    @override_settings(
        LOCATIONIQ_API_KEY="pk-test",
        LOCATIONIQ_AUTOCOMPLETE_URL="https://example.test/autocomplete",
        LOCATIONIQ_SEARCH_URL="https://example.test/search",
        LOCATIONIQ_REVERSE_URL="https://example.test/reverse",
        LOCATIONIQ_LOOKUP_URL="https://example.test/lookup",
    )
    @patch("commerce.places.locationiq.get_json")
    def test_reverse_geocode(self, get_json):
        get_json.return_value = {
            "osm_type": "node",
            "osm_id": "55",
            "lat": "25.08",
            "lon": "55.14",
            "display_name": "Dubai Marina",
            "address": {"postcode": "00000"},
        }
        provider = LocationIQProvider()
        result = provider.geocode(latitude=Decimal("25.08"), longitude=Decimal("55.14"))
        self.assertEqual(result.status, "OK")
        self.assertEqual(result.place_id, "N55")
        self.assertEqual(result.postal_code, "00000")


class GoogleProviderTests(SimpleTestCase):
    @override_settings(
        GOOGLE_MAPS_API_KEY="g-test",
        GOOGLE_GEOCODE_URL="https://example.test/geocode",
        GOOGLE_PLACES_AUTOCOMPLETE_URL="https://example.test/autocomplete",
    )
    @patch("commerce.places.google.get_json")
    def test_autocomplete_and_place_geocode(self, get_json):
        get_json.side_effect = [
            {
                "status": "OK",
                "predictions": [
                    {"place_id": "ChIJ123", "description": "Dubai Marina, Dubai"},
                ],
            },
            {
                "status": "OK",
                "results": [
                    {
                        "formatted_address": "Dubai Marina, Dubai, UAE",
                        "place_id": "ChIJ123",
                        "address_components": [
                            {"long_name": "00000", "short_name": "00000", "types": ["postal_code"]},
                        ],
                        "geometry": {"location": {"lat": 25.08, "lng": 55.14}},
                    }
                ],
            },
        ]
        provider = GoogleProvider()
        rows = provider.autocomplete(query="marina")
        self.assertEqual(rows[0].place_id, "ChIJ123")
        result = provider.geocode(place_id="ChIJ123")
        self.assertEqual(result.status, "OK")
        self.assertEqual(result.postal_code, "00000")
