"""Merge a client-filled import workbook into our master Sortd_Product_Import.xlsx."""

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from catalog.import_merge import backup_workbook, merge_import_rows, parse_launch_rows
from catalog.import_template import build_import_workbook_from_rows
from catalog.tests.fixtures.build_full_import_workbook import highlight_example_row, update_readme_note

DEFAULT_BASE = Path.home() / "Downloads" / "Sortd_Product_Import.xlsx"
DEFAULT_OUTPUT = Path.home() / "Downloads" / "Sortd_Product_Import.xlsx"


class Command(BaseCommand):
    help = "Merge client-filled Launch range data into the master import workbook."

    def add_arguments(self, parser):
        parser.add_argument(
            "filled",
            type=str,
            help="Path to the client-filled .xlsx (Launch range sheet).",
        )
        parser.add_argument(
            "--base",
            type=str,
            default=str(DEFAULT_BASE),
            help=f"Master workbook to update (default: {DEFAULT_BASE}).",
        )
        parser.add_argument(
            "--output",
            type=str,
            default=str(DEFAULT_OUTPUT),
            help=f"Where to write the merged workbook (default: {DEFAULT_OUTPUT}).",
        )
        parser.add_argument(
            "--no-backup",
            action="store_true",
            help="Do not create a timestamped backup of the output file before overwriting.",
        )

    def handle(self, *args, **options):
        filled_path = Path(options["filled"])
        base_path = Path(options["base"])
        output_path = Path(options["output"])

        if not filled_path.is_file():
            raise CommandError(f"Filled workbook not found: {filled_path}")
        if not base_path.is_file():
            raise CommandError(f"Base workbook not found: {base_path}")

        base_rows = parse_launch_rows(base_path)
        filled_rows = parse_launch_rows(filled_path)
        merged_rows, stats = merge_import_rows(base_rows, filled_rows)

        if not options["no_backup"] and output_path.is_file():
            backup = backup_workbook(output_path)
            if backup:
                self.stdout.write(f"Backup: {backup}")

        row_count = build_import_workbook_from_rows(merged_rows, output_path)
        if any(_cell(row.get("sortd_sku")).upper() == "SRT-EXAMPLE-001" for row in merged_rows):
            highlight_example_row(output_path, "SRT-EXAMPLE-001")
            update_readme_note(output_path)

        self.stdout.write(
            self.style.SUCCESS(
                f"Wrote {output_path} ({row_count} rows). "
                f"Updated {stats['updated_skus']} SKU(s), {stats['fields_updated']} field(s); "
                f"added {stats['added_skus']} new SKU(s)."
            )
        )
