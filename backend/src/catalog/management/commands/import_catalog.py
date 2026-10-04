"""Load the homepage catalog JSON into the database."""

from pathlib import Path
import json

from django.core.management.base import BaseCommand, CommandError

from catalog.importer import CatalogImporter, CatalogImportError

DEFAULT_PATH = Path(__file__).resolve().parents[2] / "data" / "storefront_products.json"


class Command(BaseCommand):
    help = "Import categories and products from catalog/data/storefront_products.json"

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            type=str,
            default=str(DEFAULT_PATH),
            help="JSON file to import (defaults to the homepage seed).",
        )
        parser.add_argument("--dry-run", action="store_true", help="Validate the file without writing.")

    def handle(self, *args, **options):
        path = Path(options["path"])
        if not path.exists():
            raise CommandError(f"Catalog file not found: {path}")
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"Invalid JSON in {path}: {exc}") from exc

        product_count = len(payload.get("products") or [])
        if options["dry_run"]:
            self.stdout.write(f"Dry run: {path} has {product_count} products.")
            return

        try:
            result = CatalogImporter().import_payload(payload)
        except CatalogImportError as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {result.categories} categories, "
                f"created {result.created} products, updated {result.updated}."
            )
        )
