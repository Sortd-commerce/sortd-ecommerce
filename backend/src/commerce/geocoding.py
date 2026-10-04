"""Compatibility exports for the places provider abstraction."""

from commerce.places import (
    AutocompleteSuggestion,
    GeocodeResult,
    PlacesProvider,
    build_geocoder,
    build_places_provider,
)
from commerce.places.closed import ClosedProvider
from commerce.places.fixture import FixtureProvider
from commerce.places.google import GoogleProvider
from commerce.places.locationiq import LocationIQProvider

# Legacy names used in older docs/tests.
ClosedGeocoder = ClosedProvider
FixtureGeocoder = FixtureProvider
GoogleGeocoder = GoogleProvider
Geocoder = PlacesProvider

__all__ = [
    "AutocompleteSuggestion",
    "ClosedGeocoder",
    "ClosedProvider",
    "FixtureGeocoder",
    "FixtureProvider",
    "GeocodeResult",
    "Geocoder",
    "GoogleGeocoder",
    "GoogleProvider",
    "LocationIQProvider",
    "PlacesProvider",
    "build_geocoder",
    "build_places_provider",
]
