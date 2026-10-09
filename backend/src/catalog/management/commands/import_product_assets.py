"""Upload local product image folders to Cloudinary via ProductImage rows."""

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from catalog.product_assets import ProductAssetImporter


class Command(BaseCommand):
    help = "Import product gallery images from a Sortd_Products assets folder."

    def add_arguments(self, parser):
        parser.add_argument(
            "--assets-dir",
            type=str,
            required=True,
            help="Path to the Sortd_Products folder containing products.json.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate matching and file paths without uploading.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Replace existing product galleries.",
        )
        parser.add_argument(
            "--sku",
            type=str,
            help="Import images for one Sortd SKU only, e.g. SRT-BRK-001.",
        )
        parser.add_argument(
            "--rematch-colliding-titles",
            action="store_true",
            help="Re-upload images for SKUs that share a page title with another product (fixes brand mix-ups).",
        )

    def handle(self, *args, **options):
        assets_dir = Path(options["assets_dir"])
        if not assets_dir.is_dir():
            raise CommandError(f"Assets folder not found: {assets_dir}")

        importer = ProductAssetImporter(assets_dir)
        result = importer.run(
            dry_run=options["dry_run"],
            force=options["force"],
            sku_filter=options.get("sku"),
            rematch_colliding_titles=options["rematch_colliding_titles"],
        )

        for issue in result.issues:
            line = f"[{issue.level}] {issue.sku} · {issue.field}: {issue.message}"
            if issue.level == "error":
                self.stderr.write(self.style.ERROR(line))
            elif issue.level == "warning":
                self.stderr.write(self.style.WARNING(line))
            else:
                self.stdout.write(line)

        if result.errors:
            raise CommandError(f"Import blocked by {len(result.errors)} error(s).")

        mode = "Dry run" if result.dry_run else "Import"
        self.stdout.write(
            self.style.SUCCESS(
                f"{mode} complete: matched {result.matched} product(s), "
                f"uploaded {result.uploaded_images} image(s) across {result.uploaded_products} product(s), "
                f"resized {result.resized_images} image(s), "
                f"skipped {result.skipped_products} product(s), "
                f"{len(result.issues)} note(s)."
            )
        )
