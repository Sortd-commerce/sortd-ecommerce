from django.db import transaction

from catalog.models import LabReport


def publish_report(report: LabReport) -> LabReport:
    with transaction.atomic():
        LabReport.objects.filter(product=report.product, is_current=True).exclude(pk=report.pk).update(is_current=False)
        report.is_current = True
        report.save(update_fields=["is_current"])
    return report
