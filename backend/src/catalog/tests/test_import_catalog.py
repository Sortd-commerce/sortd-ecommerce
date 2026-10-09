from decimal import Decimal
from io import StringIO

from django.test import TestCase

from catalog.importer import CatalogImporter
from catalog.models import Product, ProductVariant


class CatalogImporterTests(TestCase):
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
        payload = {
            "categories": [{"name": "Snacks", "slug": "snacks", "sort_order": 1}],
            "products": [
                {
                    "title": "Coffee cocoa protein bar",
                    "slug": "coffee-cocoa-protein-bar",
                    "category": "snacks",
                    "status": "active",
                    "description": "Checked.",
                    "variants": [
                        {"sku": "SNK-COF-16", "title": "Single bar", "price": "16.90", "unit_count": 1, "on_hand": 40},
                        {"sku": "SNK-COF-5P", "title": "Pack of 5", "price": "79.90", "unit_count": 5, "on_hand": 18},
                    ],
                    "related_slugs": ["raspberry-cacao-protein-bar"],
                    "related_kind": "flavor",
                    "nutrition": {"headline": "Protein-led. 20.3 g in every bar."},
                    "ingredients": [{"name": "Cashews", "share_percent": "35.00"}],
                },
                {
                    "title": "Raspberry cacao protein bar",
                    "slug": "raspberry-cacao-protein-bar",
                    "category": "snacks",
                    "status": "active",
                    "variant": {"sku": "SNK-RAS-16", "title": "Single bar", "price": "16.90", "on_hand": 40},
                },
            ],
        }
        CatalogImporter().import_payload(payload)
        coffee = Product.objects.get(slug="coffee-cocoa-protein-bar")
        self.assertEqual(coffee.variants.count(), 2)
        self.assertTrue(coffee.related_links.filter(related__slug="raspberry-cacao-protein-bar").exists())
        self.assertEqual(coffee.nutrition.headline, "Protein-led. 20.3 g in every bar.")
        self.assertEqual(coffee.ingredients.get(name="Cashews").share_percent, Decimal("35.00"))
