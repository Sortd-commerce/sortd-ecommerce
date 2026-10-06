from django.db.models import Prefetch

from catalog.models import LabReport, Product, ProductStatus


def report_score(report: LabReport | None) -> tuple[int, int]:
    if report is None:
        return 0, 0
    results = []
    for section in report.sections.all():
        results.extend(list(section.results.all()))
    if not results:
        return 0, 0
    passed = sum(1 for result in results if result.passed)
    return passed, len(results)


def report_has_passed(report: LabReport | None) -> bool:
    if report is None or not report.is_current:
        return False
    passed, total = report_score(report)
    if total == 0:
        return bool(report.pdf)
    return passed == total


def product_has_lab_report(report: LabReport | None) -> bool:
    return report is not None and report.is_current and bool(report.pdf)


def active_products():
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
            Prefetch(
                "lab_reports",
                queryset=LabReport.objects.filter(is_current=True).prefetch_related("sections__results"),
                to_attr="current_reports",
            ),
            "related_links__related",
        )
    )


def current_report(product: Product) -> LabReport | None:
    reports = getattr(product, "current_reports", None)
    if reports is not None:
        return reports[0] if reports else None
    return product.lab_reports.filter(is_current=True).first()
