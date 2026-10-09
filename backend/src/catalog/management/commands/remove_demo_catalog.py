"""Delete legacy demo / JSON-seed products (not the 117 SKU launch range)."""

from django.core.management.base import BaseCommand

from catalog.demo_catalog import delete_demo_catalog_products


class Command(BaseCommand):
    help = "Remove demo-only catalog products (PLAAAY, demo chocolate rows, old JSON storefront SKUs)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List demo products that would be deleted without changing the database.",
        )
        parser.add_argument(
            "--keep-media",
            action="store_true",
            help="Leave Cloudinary/disk image files in place.",
        )

    def handle(self, *args, **options):
        from catalog.demo_catalog import iter_demo_products

        products = list(iter_demo_products())
        if options["dry_run"]:
            if not products:
                self.stdout.write("No demo catalog products found.")
                return
            for product in products:
                skus = ", ".join(product.variants.values_list("sku", flat=True))
                self.stdout.write(f"Would delete: {product.title} ({skus})")
            return

        removed, skus = delete_demo_catalog_products(delete_media=not options["keep_media"])
        if removed == 0:
            self.stdout.write(self.style.SUCCESS("No demo catalog products found."))
            return
        self.stdout.write(
            self.style.SUCCESS(f"Removed {removed} demo product(s): {', '.join(skus)}")
        )
