from django.conf import settings
from django.db.models import Prefetch

from catalog.models import LabReport, Product, ProductStatus, ProductVariant, RelatedProduct


def report_score(report: LabReport | None) -> tuple[int, int]:
    if report is None:
        return 0, 0
    passed = 0
    total = 0
    for section in report.sections.all():
        for result in section.results.all():
            total += 1
            if result.passed:
                passed += 1
    if total == 0:
        return 0, 0
    return passed, total


def active_variants(product: Product) -> list[ProductVariant]:
    return [variant for variant in product.variants.all() if variant.is_active]


def report_has_passed(report: LabReport | None) -> bool:
    if report is None or not report.is_current:
        return False
    passed, total = report_score(report)
    if total == 0:
        return False
    return passed == total


def product_has_lab_report(report: LabReport | None) -> bool:
    return report is not None and report.is_current and bool(report.pdf)


def lab_report_file_url(slug: str, report: LabReport | None = None) -> str | None:
    if report is None or not report.is_current or not report.pdf:
        return None
    origin = settings.PUBLIC_API_ORIGIN.rstrip("/")
    return f"{origin}/api/v1/products/{slug}/report/file"


def _current_lab_reports_prefetch() -> Prefetch:
    return Prefetch(
        "lab_reports",
        queryset=LabReport.objects.filter(is_current=True).prefetch_related("sections__results"),
        to_attr="current_reports",
    )


def active_products_list():
    """Storefront grid/search: category, images, variants, and lab pass flags only."""
    return (
        Product.objects.filter(status=ProductStatus.ACTIVE, category__is_active=True)
        .select_related("category")
        .prefetch_related("images", "variants", _current_lab_reports_prefetch())
    )


def active_product_detail():
    """Single product page: full label, related links, and lab graph."""
    return (
        Product.objects.filter(status=ProductStatus.ACTIVE, category__is_active=True)
        .select_related("category", "nutrition")
        .prefetch_related(
            "images",
            "variants",
            "ingredients",
            "allergens",
            "additives",
            "nutrition__facts",
            _current_lab_reports_prefetch(),
            Prefetch(
                "related_links",
                queryset=RelatedProduct.objects.select_related("related").order_by("sort_order", "id"),
            ),
        )
    )


def active_products():
    """Backward-compatible alias for detail-shaped queryset."""
    return active_product_detail()


def current_report(product: Product) -> LabReport | None:
    reports = getattr(product, "current_reports", None)
    if reports is not None:
        return reports[0] if reports else None
    return product.lab_reports.filter(is_current=True).first()
