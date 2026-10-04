"""Resolve local vs production and the database that goes with each."""

from pathlib import Path

import environ
from django.core.exceptions import ImproperlyConfigured

LOCAL = "local"
PRODUCTION = "production"
ENVIRONMENTS = {LOCAL, PRODUCTION}

SQLITE_ENGINE = "django.db.backends.sqlite3"
POSTGRES_ENGINE = "django.db.backends.postgresql"
POSTGRES_SCHEMES = ("postgres://", "postgresql://")


def resolve_environment(value: str | None) -> str:
    environment = (value or "").strip().lower() or LOCAL
    if environment not in ENVIRONMENTS:
        raise ImproperlyConfigured("ENVIRONMENT must be 'local' or 'production'.")
    return environment


def _postgres_config(url: str, *, conn_max_age: int, ssl_require: bool) -> dict:
    lowered = url.strip().lower()
    if not lowered.startswith(POSTGRES_SCHEMES):
        raise ImproperlyConfigured("DATABASE_URL must be a PostgreSQL URL (postgres://...).")
    config = environ.Env.db_url_config(url)
    if config.get("ENGINE") != POSTGRES_ENGINE:
        raise ImproperlyConfigured("DATABASE_URL must be a PostgreSQL URL (postgres://...).")
    config["CONN_MAX_AGE"] = conn_max_age
    config["CONN_HEALTH_CHECKS"] = True
    options = dict(config.get("OPTIONS") or {})
    if ssl_require:
        options.setdefault("sslmode", "require")
    if options:
        config["OPTIONS"] = options
    return config


def database_for_environment(
    environment: str,
    *,
    base_dir: Path,
    database_url: str = "",
    conn_max_age: int = 0,
    ssl_require: bool | None = None,
) -> dict:
    """SQLite by default locally. PostgreSQL when DATABASE_URL is set, and always in production."""

    url = database_url.strip()
    if environment == LOCAL and not url:
        return {
            "ENGINE": SQLITE_ENGINE,
            "NAME": base_dir / "db.sqlite3",
        }

    if environment == PRODUCTION and not url:
        raise ImproperlyConfigured("DATABASE_URL is required when ENVIRONMENT=production.")

    if environment not in ENVIRONMENTS:
        raise ImproperlyConfigured("ENVIRONMENT must be 'local' or 'production'.")

    require_ssl = ssl_require if ssl_require is not None else environment == PRODUCTION
    return _postgres_config(url, conn_max_age=conn_max_age, ssl_require=require_ssl)
