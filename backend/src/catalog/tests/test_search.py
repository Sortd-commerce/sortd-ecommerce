from accounts.tests.helpers import ApiTestCase, make_service_token
from catalog.tests.test_catalog import make_product
from catalog.models import Category


class CatalogSearchTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.headers = {"HTTP_X_SERVICE_TOKEN": make_service_token()}

    def test_search_returns_products_and_categories(self):
        category = Category.objects.filter(is_active=True).first()
        product, _variant = make_product(title="Dark Cocoa Bar", slug="dark-cocoa-bar")
        response = self.client.get("/api/v1/products/search?q=cocoa&limit=3", **self.headers)
        self.assertEqual(response.status_code, 200)
        rows = response.json()["data"]
        kinds = {row["kind"] for row in rows}
        self.assertIn("product", kinds)
        self.assertTrue(any(row["slug"] == product.slug for row in rows if row["kind"] == "product"))
        if category and "cocoa" in category.name.lower():
            self.assertIn("category", kinds)

    def test_search_requires_two_characters(self):
        response = self.client.get("/api/v1/products/search?q=a", **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"], [])
