"""Remove dummy catalog data, orders, and carts. User accounts are kept."""

from django.core.management.base import BaseCommand, CommandError

from catalog.clear import clear_catalog_data


class Command(BaseCommand):
    help = "Delete all products, categories, orders, cart items, and discounts. Keeps user accounts."

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Skip the confirmation prompt.",
        )
        parser.add_argument(
            "--keep-media",
            action="store_true",
            help="Do not delete product images or lab report files from storage.",
        )

    def handle(self, *args, **options):
        if not options["yes"]:
            self.stdout.write(
                "This will permanently delete all products, categories, orders, cart items, "
                "discounts, and their media files. User accounts will be kept."
            )
            confirm = input("Type 'yes' to continue: ").strip().lower()
            if confirm != "yes":
                raise CommandError("Aborted.")

        result = clear_catalog_data(delete_media=not options["keep_media"])
        self.stdout.write(
            self.style.SUCCESS(
                f"Cleared {result.products} products, {result.categories} categories, "
                f"{result.orders} orders, {result.cart_items} cart items, "
                f"and {result.discounts} discounts."
            )
        )
