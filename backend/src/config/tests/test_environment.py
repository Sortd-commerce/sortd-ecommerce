from pathlib import Path

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from config.environment import (
    LOCAL,
    POSTGRES_ENGINE,
    PRODUCTION,
    SQLITE_ENGINE,
    database_for_environment,
    resolve_environment,
)


class EnvironmentTests(SimpleTestCase):
    def test_blank_environment_defaults_to_local(self):
        self.assertEqual(resolve_environment(None), LOCAL)
        self.assertEqual(resolve_environment("  "), LOCAL)

    def test_environment_is_case_insensitive(self):
        self.assertEqual(resolve_environment("LOCAL"), LOCAL)
        self.assertEqual(resolve_environment("Production"), PRODUCTION)

    def test_unknown_environment_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            resolve_environment("staging")

    def test_local_without_url_uses_sqlite(self):
        base_dir = Path("/tmp/sortd")
        config = database_for_environment(LOCAL, base_dir=base_dir)

        self.assertEqual(config["ENGINE"], SQLITE_ENGINE)
        self.assertEqual(config["NAME"], base_dir / "db.sqlite3")

    def test_local_with_url_uses_postgres(self):
        config = database_for_environment(
            LOCAL,
            base_dir=Path("/tmp/sortd"),
            database_url="postgres://user:pass@localhost:5432/sortd",
        )

        self.assertEqual(config["ENGINE"], POSTGRES_ENGINE)
        self.assertEqual(config["NAME"], "sortd")
        self.assertNotIn("sslmode", config.get("OPTIONS", {}))

    def test_production_requires_a_database_url(self):
        with self.assertRaisesMessage(
            ImproperlyConfigured,
            "DATABASE_URL is required when ENVIRONMENT=production.",
        ):
            database_for_environment(PRODUCTION, base_dir=Path("/tmp/sortd"), database_url="")

    def test_production_rejects_non_postgres(self):
        with self.assertRaisesMessage(ImproperlyConfigured, "must be a PostgreSQL URL"):
            database_for_environment(
                PRODUCTION,
                base_dir=Path("/tmp/sortd"),
                database_url="sqlite:///db.sqlite3",
            )
        with self.assertRaisesMessage(ImproperlyConfigured, "must be a PostgreSQL URL"):
            database_for_environment(
                PRODUCTION,
                base_dir=Path("/tmp/sortd"),
                database_url="mysql://user:pass@db.internal:3306/sortd",
            )

    def test_production_reads_a_postgres_url(self):
        config = database_for_environment(
            PRODUCTION,
            base_dir=Path("/tmp/sortd"),
            database_url="postgres://user:pass@db.internal:5432/sortd",
            conn_max_age=60,
        )

        self.assertEqual(config["ENGINE"], POSTGRES_ENGINE)
        self.assertEqual(config["NAME"], "sortd")
        self.assertEqual(config["USER"], "user")
        self.assertEqual(config["HOST"], "db.internal")
        self.assertEqual(config["PORT"], 5432)
        self.assertEqual(config["CONN_MAX_AGE"], 60)
        self.assertEqual(config["OPTIONS"]["sslmode"], "require")

    def test_running_settings_are_local_sqlite(self):
        self.assertEqual(settings.ENVIRONMENT, LOCAL)
        self.assertEqual(settings.DATABASES["default"]["ENGINE"], SQLITE_ENGINE)
