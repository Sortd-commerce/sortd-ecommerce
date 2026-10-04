from datetime import date
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from accounts.tests.helpers import ApiTestCase, signup_and_verify, bearer, post_json
from catalog.models import (
    Additive,
    Category,
    Ingredient,
    LabReport,
    LabReportResult,
    LabReportSection,
    NutritionFact,
    NutritionProfile,
    Product,
    ProductStatus,
    ProductVariant,
)
from catalog.queries import report_has_passed
from catalog.reports import publish_report
from catalog.stock import StockService
from commerce.models import DeliveryPostalCode, DeliveryWindow, PaymentMethod, Address


PDF = SimpleUploadedFile("report.pdf", b"%PDF-1.4 test", content_type="application/pdf")


def make_product(*, slug="coffee-bar", title="20g Protein Bar, Coffee Cocoa", on_hand=10, status=ProductStatus.ACTIVE):
    category, _ = Category.objects.get_or_create(slug="bars", defaults={"name": "Bars", "is_active": True})
    product = Product.objects.create(title=title, slug=slug, description="Checked label.", category=category, status=status)
    variant = ProductVariant.objects.create(
        product=product,
        sku=slug.upper().replace("-", "")[:12],
        title="Single bar",
        price=Decimal("16.90"),
        on_hand=on_hand,
        is_active=True,
    )
    NutritionProfile.objects.create(product=product, serving_size="60g", headline="Protein-led. 20.3 g in every bar")
    NutritionFact.objects.create(profile=product.nutrition, name="Protein", amount="20.3", unit="g", is_highlight=True)
    Ingredient.objects.create(product=product, name="Whey protein", is_flagged=True)
    Additive.objects.create(product=product, name="None", is_present=False)
    return product, variant


def make_report(product, *, passed=True, with_results=True, current=True):
    report = LabReport.objects.create(
        product=product,
        lab_name="Accredited Lab",
        accreditation="ISO 17025",
        tested_on=date(2026, 1, 1),
        summary="All 36 contaminants within limits",
        pdf=SimpleUploadedFile(f"{product.slug}.pdf", b"%PDF-1.4 test", content_type="application/pdf"),
        is_current=False,
    )
    section = LabReportSection.objects.create(
        report=report, key=LabReportSection.Key.HEAVY_METALS, title="Heavy metals"
    )
    if with_results:
        LabReportResult.objects.create(
            section=section,
            analyte="Lead (Pb)",
            detected_value="0.01",
            unit="mg/kg",
            limit_value="0.1",
            passed=passed,
        )
    if current:
        publish_report(report)
    return report


class CatalogTests(ApiTestCase):
    def test_lists_active_products_and_hides_drafts(self):
        make_product(slug="coffee-bar")
        make_product(slug="draft-bar", title="Draft", status=ProductStatus.DRAFT)

        response = self.client.get("/api/v1/products")

        self.assertEqual(response.status_code, 200)
        slugs = [row["slug"] for row in response.json()["data"]["results"]]
        self.assertEqual(slugs, ["coffee-bar"])

    def test_lists_honours_page_size(self):
        make_product(slug="alpha-bar", title="Alpha")
        make_product(slug="bravo-bar", title="Bravo")
        make_product(slug="charlie-bar", title="Charlie")

        response = self.client.get("/api/v1/products?page_size=2")

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertEqual(payload["count"], 3)
        self.assertEqual(payload["page_size"], 2)
        self.assertEqual(len(payload["results"]), 2)

    def test_draft_slug_is_not_found(self):
        make_product(slug="draft-bar", status=ProductStatus.DRAFT)

        response = self.client.get("/api/v1/products/draft-bar")

        self.assertEqual(response.status_code, 404)

    def test_product_detail_includes_label_data(self):
        product, _ = make_product()
        make_report(product)

        response = self.client.get("/api/v1/products/coffee-bar")

        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["title"], "20g Protein Bar, Coffee Cocoa")
        self.assertTrue(data["has_passed_report"])
        self.assertEqual(data["nutrition"]["headline"], "Protein-led. 20.3 g in every bar")
        self.assertEqual(data["ingredients"][0]["name"], "Whey protein")
        self.assertIn("label", data)
        self.assertEqual(data["label"]["headline"], "Protein-led. 20.3 g in every bar")

    def test_empty_lab_report_does_not_count_as_passed(self):
        product, _ = make_product()
        report = make_report(product, with_results=False)
        self.assertFalse(report_has_passed(report))

        response = self.client.get("/api/v1/products/coffee-bar")
        self.assertFalse(response.json()["data"]["has_passed_report"])

    def test_lab_report_endpoint_returns_sections(self):
        product, _ = make_product()
        make_report(product)

        response = self.client.get("/api/v1/products/coffee-bar/report")

        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["lab_name"], "Accredited Lab")
        self.assertTrue(data["passed"])
        self.assertEqual(data["sections"][0]["results"][0]["analyte"], "Lead (Pb)")


class StockTests(ApiTestCase):
    def test_set_on_hand_writes_a_movement_and_refuses_negative(self):
        _, variant = make_product(on_hand=4)
        service = StockService()
        service.set_on_hand(variant=variant, quantity=9)
        variant.refresh_from_db()
        self.assertEqual(variant.on_hand, 9)
        with self.assertRaises(Exception):
            service.set_on_hand(variant=variant, quantity=-1)
