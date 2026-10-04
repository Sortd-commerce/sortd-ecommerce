from django.conf import settings

from config.environment import LOCAL
from commerce.places.closed import ClosedProvider
from commerce.places.fixture import FixtureProvider
from commerce.places.google import GoogleProvider
from commerce.places.locationiq import LocationIQProvider
from commerce.places.protocol import PlacesProvider


def build_places_provider() -> PlacesProvider:
    override = (getattr(settings, "GEOCODER_PROVIDER", "") or "").strip().lower()
    if override == "locationiq":
        return LocationIQProvider() if settings.LOCATIONIQ_API_KEY else ClosedProvider()
    if override == "google":
        return GoogleProvider() if settings.GOOGLE_MAPS_API_KEY else ClosedProvider()
    if override == "fixture":
        return FixtureProvider()
    if settings.LOCATIONIQ_API_KEY:
        return LocationIQProvider()
    if settings.GOOGLE_MAPS_API_KEY:
        return GoogleProvider()
    if settings.ENVIRONMENT == LOCAL:
        return FixtureProvider()
    return ClosedProvider()


# Backward-compatible alias used by older call sites.
def build_geocoder() -> PlacesProvider:
    return build_places_provider()
