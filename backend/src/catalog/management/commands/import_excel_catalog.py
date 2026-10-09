"""Import products from the Sortd product listing Excel workbook."""

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from catalog.excel_importer import ExcelCatalogImporter, ExcelImportError


class Command(BaseCommand):
    help = "Import products from the Sortd product listing Excel workbook."

    def add_arguments(self, parser):
        parser.add_argument("path", type=str, help="Path to the .xlsx workbook.")
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate the workbook without writing to the database.",
        )
        parser.add_argument(
            "--force-active",
            action="store_true",
            help="Import every product as active, ignoring the Excel status column.",
        )
        parser.add_argument(
            "--skip-images",
            action="store_true",
            help="Skip main/gallery URLs and aisle images (use import_product_assets for local folders).",
        )

    def handle(self, *args, **options):
        path = Path(options["path"])
        if not path.exists():
            raise CommandError(f"Workbook not found: {path}")

        importer = ExcelCatalogImporter()
        try:
            with path.open("rb") as handle:
                result = importer.import_file(
                    handle,
                    dry_run=options["dry_run"],
                    force_active=options["force_active"],
                    skip_images=options["skip_images"],
                )
        except ExcelImportError as exc:
            raise CommandError(str(exc)) from exc

        if result.errors:
            for issue in result.errors:
                self.stderr.write(f"Row {issue.row} [{issue.field}] {issue.message}")
            raise CommandError(f"Import blocked by {len(result.errors)} validation error(s).")

        if options["dry_run"]:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Dry run passed for {result.row_count} product row(s). "
                    f"{len(result.warnings)} warning(s)."
                )
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {result.row_count} row(s): "
                f"created {result.created}, updated {result.updated}, skipped {result.skipped}."
            )
        )
