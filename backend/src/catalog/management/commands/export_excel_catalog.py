"""Export the live catalog to a client-facing import workbook."""

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from catalog.excel_export import aisle_rows_for_export, export_import_rows, load_base_rows
from catalog.import_template import build_import_workbook_from_rows


class Command(BaseCommand):
    help = "Write a Sortd product import workbook from the database (Launch range layout)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            type=str,
            default=str(Path(__file__).resolve().parents[4] / "data" / "Sortd_Launch_Range_client_export.xlsx"),
            help="Path for the generated .xlsx file.",
        )
        parser.add_argument(
            "--base-json",
            type=str,
            default=str(Path(__file__).resolve().parents[4] / "data" / "launch_range_products.json"),
            help="Optional JSON row source for fields not stored on Product (e.g. label_template).",
        )
        parser.add_argument(
            "--preserve-image-paths",
            action="store_true",
            help="Keep non-URL image paths in the sheet instead of blanking them.",
        )

    def handle(self, *args, **options):
        output_path = Path(options["output"])
        base_json = Path(options["base_json"]) if options["base_json"] else None
        if base_json and not base_json.is_file():
            self.stdout.write(self.style.WARNING(f"Base JSON not found ({base_json}); exporting DB fields only."))
            base_json = None

        sku_order: list[str] | None = None
        if base_json:
            sku_order = list(load_base_rows(base_json).keys())

        rows = export_import_rows(base_rows_path=base_json, sku_order=sku_order)
        if not rows:
            raise CommandError("No products found to export.")

        aisle_rows = aisle_rows_for_export()
        row_count = build_import_workbook_from_rows(
            rows,
            output_path,
            preserve_image_paths=options["preserve_image_paths"],
            aisle_rows=aisle_rows,
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Wrote {output_path} with {row_count} product row(s) ({output_path.stat().st_size // 1024} KB)."
            )
        )
