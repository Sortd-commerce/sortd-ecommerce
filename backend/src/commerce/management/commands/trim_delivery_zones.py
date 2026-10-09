"""Keep only the configured reference delivery zones (launch: JLT only)."""

from django.core.management.base import BaseCommand
from django.utils.text import slugify

from commerce.delivery_zone_seeds import REFERENCE_DELIVERY_ZONES
from commerce.models import DeliveryZone


class Command(BaseCommand):
    help = "Delete delivery zones not in reference seeds and upsert the launch zone list."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print changes without writing to the database.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        keep_slugs = {row["slug"] for row in REFERENCE_DELIVERY_ZONES}
        existing = list(DeliveryZone.objects.all())
        to_delete = [zone for zone in existing if zone.slug not in keep_slugs]

        if to_delete:
            self.stdout.write(f"Removing {len(to_delete)} zone(s): {', '.join(z.name for z in to_delete)}")
        else:
            self.stdout.write("No extra delivery zones to remove.")

        if not dry_run and to_delete:
            DeliveryZone.objects.filter(id__in=[zone.id for zone in to_delete]).delete()

        for row in REFERENCE_DELIVERY_ZONES:
            slug = slugify(row["slug"])[:120]
            defaults = {
                "name": row["name"],
                "polygon": row["polygon"],
                "delivery_fee": row["delivery_fee"],
                "sort_order": row["sort_order"],
                "is_active": True,
            }
            if dry_run:
                self.stdout.write(f"Would upsert zone {defaults['name']} ({slug})")
                continue
            DeliveryZone.objects.update_or_create(slug=slug, defaults=defaults)

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run only — no database changes."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Delivery zones synced ({DeliveryZone.objects.count()} total)."))
