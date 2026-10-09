"""Create default weekly delivery windows (idempotent)."""

from datetime import time

from django.core.management.base import BaseCommand

from commerce.models import DeliveryWindow

# weekday: 0=Monday … 6=Sunday (Python date.weekday())
_SLOT_TEMPLATES = (
    (time(9, 0), time(12, 0), 40, 120),
    (time(12, 0), time(15, 0), 40, 90),
    (time(15, 0), time(18, 0), 40, 90),
    (time(18, 0), time(21, 0), 35, 60),
)

DEFAULT_WINDOWS = [
    {
        "weekday": day,
        "start_time": start,
        "end_time": end,
        "capacity": capacity,
        "cutoff_minutes": cutoff,
    }
    for day in range(7)
    for start, end, capacity, cutoff in _SLOT_TEMPLATES
]

_WEEKDAY_LABELS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


class Command(BaseCommand):
    help = "Seed recurring delivery windows for every day of the week (safe to re-run)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Delete existing windows before seeding (default: upsert only).",
        )

    def handle(self, *args, **options):
        if options["replace"]:
            deleted, _ = DeliveryWindow.objects.all().delete()
            self.stdout.write(f"Removed {deleted} existing window(s).")

        created = 0
        updated = 0
        for row in DEFAULT_WINDOWS:
            window, was_created = DeliveryWindow.objects.update_or_create(
                weekday=row["weekday"],
                start_time=row["start_time"],
                end_time=row["end_time"],
                defaults={
                    "capacity": row["capacity"],
                    "cutoff_minutes": row["cutoff_minutes"],
                    "is_active": True,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1
            label = _WEEKDAY_LABELS[window.weekday]
            self.stdout.write(
                f"  {'+' if was_created else '~'} {label} "
                f"{window.start_time:%H:%M}–{window.end_time:%H:%M} cap={window.capacity}"
            )

        self.stdout.write(
            self.style.SUCCESS(f"Done: {created} created, {updated} updated ({len(DEFAULT_WINDOWS)} slots/week).")
        )
