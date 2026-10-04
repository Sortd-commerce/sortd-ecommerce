import json
from decimal import Decimal
from io import StringIO
from pathlib import Path
from tempfile import NamedTemporaryFile

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from catalog.importer import CatalogImporter
from catalog.models import Category, Product, ProductVariant

SEED_PATH = Path(__file__).resolve().parents[1] / "data" / "storefront_products.json"


class CatalogImporterTests(TestCase):
    def test_seed_json_has_unique_slugs_and_skus(self):
        payload = json.loads(SEED_PATH.read_text(encoding="utf-8"))
        slugs = [row["slug"] for row in payload["products"]]
        skus = []
        for row in payload["products"]:
            if row.get("variant"):
                skus.append(row["variant"]["sku"])
            skus.extend(item["sku"] for item in row.get("variants") or [])
        self.assertEqual(len(payload["products"]), 30)
        self.assertEqual(len(slugs), len(set(slugs)))
        self.assertEqual(len(skus), len(set(skus)))
        self.assertEqual(len(payload["categories"]), 5)

    def test_import_is_idempotent_and_updates_price(self):
        payload = {
            "categories": [{"name": "Bars", "slug": "bars", "sort_order": 1}],
            "products": [
                {
                    "title": "Coffee bar",
                    "slug": "coffee-bar",
                    "category": "bars",
                    "status": "active",
                    "description": "Checked.",
                    "variant": {"sku": "TEST-COF-1", "title": "Single", "price": "16.90", "on_hand": 10},
                    "ingredients": [{"name": "Whey protein", "is_flagged": True}],
                    "additives": [{"name": "None", "is_present": False}],
                }
            ],
        }
        first = CatalogImporter().import_payload(payload)
        self.assertEqual(first.created, 1)
        payload["products"][0]["variant"]["price"] = "18.50"
        payload["products"][0]["variant"]["on_hand"] = 7
        second = CatalogImporter().import_payload(payload)
        self.assertEqual(second.created, 0)
        self.assertEqual(second.updated, 1)
        variant = ProductVariant.objects.get(sku="TEST-COF-1")
        self.assertEqual(variant.price, Decimal("18.50"))
        self.assertEqual(variant.on_hand, 7)
        self.assertEqual(Product.objects.count(), 1)

    def test_import_links_flavours_and_pack_offers(self):
        payload = json.loads(SEED_PATH.read_text(encoding="utf-8"))
        CatalogImporter().import_payload(payload)
        coffee = Product.objects.get(slug="coffee-cocoa-protein-bar")
        self.assertEqual(coffee.variants.count(), 3)
        self.assertTrue(coffee.related_links.filter(related__slug="raspberry-cacao-protein-bar").exists())
        self.assertEqual(coffee.nutrition.headline, "Protein-led. 20.3 g in every bar.")
        self.assertEqual(coffee.ingredients.get(name="Cashews").share_percent, Decimal("35.00"))

    def test_command_loads_seed_file(self):
        out = StringIO()
        call_command("import_catalog", stdout=out)
        self.assertEqual(Category.objects.count(), 5)
        self.assertEqual(Product.objects.filter(status="active").count(), 30)
        self.assertIn("created 30", out.getvalue())

    def test_command_dry_run_does_not_write(self):
        call_command("import_catalog", dry_run=True, stdout=StringIO())
        self.assertEqual(Product.objects.count(), 0)

    def test_command_rejects_missing_file(self):
        with self.assertRaises(CommandError):
            call_command("import_catalog", path="missing.json")

    def test_command_accepts_custom_path(self):
        payload = {
            "categories": [{"name": "Drinks", "slug": "drinks"}],
            "products": [
                {
                    "title": "Ginger tonic",
                    "slug": "ginger-tonic",
                    "category": "drinks",
                    "variant": {"sku": "DRK-1", "price": "12.90", "on_hand": 4},
                }
            ],
        }
        tmp = NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8")
        try:
            json.dump(payload, tmp)
            tmp.close()
            call_command("import_catalog", path=tmp.name, stdout=StringIO())
        finally:
            Path(tmp.name).unlink(missing_ok=True)
        self.assertTrue(Product.objects.filter(slug="ginger-tonic").exists())
