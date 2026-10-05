"""Project settings. Secrets and environment-specific values come from .env."""

from datetime import timedelta
from pathlib import Path

import environ
from django.core.exceptions import ImproperlyConfigured

from config.environment import LOCAL, PRODUCTION, database_for_environment, resolve_environment
from config.mailers import build_mailers, require_production_from_address
from config.storages import build_media_storages

SRC_DIR = Path(__file__).resolve().parent.parent
BASE_DIR = SRC_DIR.parent

env = environ.Env(
    DEBUG=(bool, False),
    USE_HTTPS=(bool, False),
    NUM_PROXIES=(int, 0),
    JWT_ACCESS_MINUTES=(int, 15),
    JWT_REFRESH_DAYS=(int, 7),
    PAGE_SIZE=(int, 20),
    MAX_PAGE_SIZE=(int, 100),
    SERVICE_TOKEN_MAX_SECONDS=(int, 300),
)
environ.Env.read_env(BASE_DIR / ".env")

ENVIRONMENT = resolve_environment(env("ENVIRONMENT", default=LOCAL))
SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
JWT_SIGNING_KEY = env("JWT_SIGNING_KEY", default=SECRET_KEY)
SERVICE_SIGNING_KEY = env("SERVICE_SIGNING_KEY", default="")

_INSECURE_SECRETS = {
    "",
    "change-me",
    "change-me-in-production",
    "change-me-in-production-too",
    "local-service-signing-key-change-me",
}
if ENVIRONMENT == PRODUCTION and DEBUG:
    raise ImproperlyConfigured("DEBUG must be False when ENVIRONMENT=production.")
if ENVIRONMENT == PRODUCTION and (
    SECRET_KEY in _INSECURE_SECRETS or JWT_SIGNING_KEY in _INSECURE_SECRETS
):
    raise ImproperlyConfigured(
        "Set a unique SECRET_KEY and JWT_SIGNING_KEY before running in production."
    )
if ENVIRONMENT == PRODUCTION:
    if (
        SERVICE_SIGNING_KEY in _INSECURE_SECRETS
        or SERVICE_SIGNING_KEY == JWT_SIGNING_KEY
        or SERVICE_SIGNING_KEY == SECRET_KEY
    ):
        raise ImproperlyConfigured(
            "Set a unique SERVICE_SIGNING_KEY, different from JWT_SIGNING_KEY, before running in production."
        )
elif not SERVICE_SIGNING_KEY:
    SERVICE_SIGNING_KEY = "local-service-signing-key-change-me"

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "ninja_extra",
    "ninja_jwt",
    "ninja_jwt.token_blacklist",
    "config.apps.ConfigConfig",
    "core.apps.CoreConfig",
    "accounts.apps.AccountsConfig",
    "catalog.apps.CatalogConfig",
    "commerce.apps.CommerceConfig",
    "anymail",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "core.middleware.ServiceTokenMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": database_for_environment(
        ENVIRONMENT,
        base_dir=BASE_DIR,
        database_url=env("DATABASE_URL", default=""),
        conn_max_age=env.int("DATABASE_CONN_MAX_AGE", default=60 if ENVIRONMENT == PRODUCTION else 0),
        ssl_require=env.bool("DATABASE_SSL_REQUIRE", default=ENVIRONMENT == PRODUCTION),
    )
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
DELIVERY_TIMEZONE = "Asia/Dubai"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
PUBLIC_API_ORIGIN = env("PUBLIC_API_ORIGIN", default="http://127.0.0.1:8000").rstrip("/")
CLOUDINARY_CLOUD_NAME = env("CLOUDINARY_CLOUD_NAME", default="")
CLOUDINARY_API_KEY = env("CLOUDINARY_API_KEY", default="")
CLOUDINARY_API_SECRET = env("CLOUDINARY_API_SECRET", default="")
CLOUDINARY_ENABLED = bool(CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET)
if ENVIRONMENT == PRODUCTION and not CLOUDINARY_ENABLED:
    raise ImproperlyConfigured("Cloudinary credentials are required in production.")

STORAGES = build_media_storages(enabled=CLOUDINARY_ENABLED)
DEFAULT_CURRENCY = "AED"
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000").rstrip("/")
ADMIN_URL = env("ADMIN_URL", default="http://localhost:3001").rstrip("/")
SERVICE_TOKEN_ISSUER = "storefront"
SERVICE_TOKEN_ISSUERS = env.list("SERVICE_TOKEN_ISSUERS", default=["storefront", "admin"])
SERVICE_TOKEN_AUDIENCE = "sortd-api"
SERVICE_TOKEN_MAX_SECONDS = env("SERVICE_TOKEN_MAX_SECONDS")
EMAIL_VERIFICATION_MINUTES = 60
PASSWORD_RESET_MINUTES = 60
MAX_DEVICE_SESSIONS = env.int("MAX_DEVICE_SESSIONS", default=2)
GEOCODER_PROVIDER = env("GEOCODER_PROVIDER", default="")
LOCATIONIQ_API_KEY = env("LOCATIONIQ_API_KEY", default="")
LOCATIONIQ_AUTOCOMPLETE_URL = env(
    "LOCATIONIQ_AUTOCOMPLETE_URL", default="https://api.locationiq.com/v1/autocomplete"
)
LOCATIONIQ_SEARCH_URL = env("LOCATIONIQ_SEARCH_URL", default="https://us1.locationiq.com/v1/search")
LOCATIONIQ_REVERSE_URL = env("LOCATIONIQ_REVERSE_URL", default="https://us1.locationiq.com/v1/reverse")
LOCATIONIQ_LOOKUP_URL = env("LOCATIONIQ_LOOKUP_URL", default="https://us1.locationiq.com/v1/lookup")
GOOGLE_MAPS_API_KEY = env("GOOGLE_MAPS_API_KEY", default="")
GOOGLE_GEOCODE_URL = env("GOOGLE_GEOCODE_URL", default="https://maps.googleapis.com/maps/api/geocode/json")
GOOGLE_PLACES_AUTOCOMPLETE_URL = env(
    "GOOGLE_PLACES_AUTOCOMPLETE_URL",
    default="https://maps.googleapis.com/maps/api/place/autocomplete/json",
)

DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Sortd <noreply@localhost>")
if ENVIRONMENT == PRODUCTION:
    require_production_from_address(DEFAULT_FROM_EMAIL)
    if FRONTEND_URL.rstrip("/").startswith("http://localhost") or FRONTEND_URL.rstrip("/").startswith(
        "http://127.0.0.1"
    ):
        raise ImproperlyConfigured(
            "FRONTEND_URL must be the public storefront origin so verification emails work in production."
        )

_EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
BREVO_API_KEY = env("BREVO_API_KEY", default="")
ANYMAIL = {}
if BREVO_API_KEY:
    ANYMAIL["BREVO_API_KEY"] = BREVO_API_KEY
MAILERS = build_mailers(
    environment=ENVIRONMENT,
    host=env("EMAIL_HOST", default=""),
    port=env.int("EMAIL_PORT", default=587),
    username=env("EMAIL_HOST_USER", default=""),
    password=env("EMAIL_HOST_PASSWORD", default=""),
    use_tls=env.bool("EMAIL_USE_TLS", default=not _EMAIL_USE_SSL),
    use_ssl=_EMAIL_USE_SSL,
    timeout=env.int("EMAIL_TIMEOUT", default=10),
    backend=env("EMAIL_BACKEND", default=""),
    brevo_api_key=BREVO_API_KEY,
)

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

USE_HTTPS = env("USE_HTTPS")
SESSION_COOKIE_SECURE = USE_HTTPS
CSRF_COOKIE_SECURE = USE_HTTPS
SECURE_SSL_REDIRECT = USE_HTTPS
if USE_HTTPS:
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

PAGE_SIZE = env("PAGE_SIZE")
MAX_PAGE_SIZE = env("MAX_PAGE_SIZE")

NINJA_EXTRA = {
    "PAGINATION_PER_PAGE": PAGE_SIZE,
    "NUM_PROXIES": env("NUM_PROXIES"),
    "THROTTLE_RATES": {
        "anon": env("THROTTLE_ANON", default="60/min"),
        "user": env("THROTTLE_USER", default="120/min"),
        "auth": env("THROTTLE_AUTH", default="10/min"),
        "signup": env("THROTTLE_SIGNUP", default="5/min"),
        "verify": env("THROTTLE_VERIFY", default="10/min"),
        "resend": env("THROTTLE_RESEND", default="3/min"),
        "password_reset": env("THROTTLE_PASSWORD_RESET", default="5/min"),
        "places": env("THROTTLE_PLACES", default="30/min"),
    },
}

NINJA_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env("JWT_ACCESS_MINUTES")),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env("JWT_REFRESH_DAYS")),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": JWT_SIGNING_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "AUTH_TOKEN_CLASSES": ["accounts.tokens.AppAccessToken"],
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
    },
}
