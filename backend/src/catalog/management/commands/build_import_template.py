"""Build a client-facing import workbook from the full product listing."""

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from catalog.import_template import build_import_workbook

DEFAULT_OUTPUT = Path.home() / "Downloads" / "Sortd_Product_Import.xlsx"


class Command(BaseCommand):
    help = "Create a simplified import workbook with only the columns Sortd needs, backfilled from Launch range."

    def add_arguments(self, parser):
        parser.add_argument(
            "source",
            type=str,
            help="Path to the full Sortd_Product_Listing.xlsx (or any workbook with a Launch range sheet).",
        )
        parser.add_argument(
            "--output",
            type=str,
            default=str(DEFAULT_OUTPUT),
            help=f"Where to write the simplified workbook (default: {DEFAULT_OUTPUT}).",
        )

    def handle(self, *args, **options):
        source = Path(options["source"])
        output = Path(options["output"])
        if not source.exists():
            raise CommandError(f"Source workbook not found: {source}")

        row_count = build_import_workbook(source, output)
        self.stdout.write(
            self.style.SUCCESS(
                f"Wrote {output} with {row_count} product row(s) across {output.stat().st_size // 1024} KB."
            )
        )
