from django.test import TestCase

from catalog.models import Category, Product, ProductVariant
from catalog.product_assets import AssetRow, assign_rows_to_products


class ProductAssetMatchingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.category = Category.objects.create(name="Pantry", slug="cooking-pantry", sort_order=1)

    def _product(self, *, sku: str, brand: str, title: str) -> Product:
        product = Product.objects.create(
            title=title,
            slug=sku.lower().replace("_", "-"),
            brand=brand,
            category=self.category,
            status="active",
        )
        ProductVariant.objects.create(product=product, sku=sku, title="500 g", price="9.99")
        return product

    def test_same_title_different_brands_map_to_correct_folders(self):
        organic = self._product(sku="SRT-PAN-001", brand="Organic Tattva", title="Chana Dal")
        tata = self._product(sku="SRT-PAN-010", brand="Tata Sampann", title="Chana Dal")
        rows = [
            AssetRow(
                brand="Organic Tattva",
                sku="Chana Dal",
                folder="Pantry/Organic Tattva - Chana Dal",
                image_files=["01.png"],
            ),
            AssetRow(
                brand="Tata Sampann",
                sku="Chana Dal",
                folder="Pantry/Tata Sampann - Chana Dal",
                image_files=["01.png"],
            ),
        ]

        assignments = assign_rows_to_products([organic, tata], rows)

        self.assertEqual(assignments[organic.id].brand, "Organic Tattva")
        self.assertEqual(assignments[tata.id].brand, "Tata Sampann")

    def test_sortd_sku_in_manifest_wins_over_title(self):
        product = self._product(sku="SRT-PAN-010", brand="Tata Sampann", title="Chana Dal")
        other = self._product(sku="SRT-PAN-001", brand="Organic Tattva", title="Chana Dal")
        rows = [
            AssetRow(
                brand="Organic Tattva",
                sku="Chana Dal",
                folder="Pantry/Organic Tattva - Chana Dal",
                image_files=["01.png"],
                sortd_sku="SRT-PAN-010",
            ),
        ]

        assignments = assign_rows_to_products([product, other], rows)

        self.assertIn(product.id, assignments)
        self.assertNotIn(other.id, assignments)
