"""Set every catalog product to active (testing helper)."""

from django.core.management.base import BaseCommand

from catalog.models import Product, ProductStatus


class Command(BaseCommand):
    help = "Set all products to active status. Useful while testing before Excel rows are Live."

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Skip the confirmation prompt.",
        )

    def handle(self, *args, **options):
        count = Product.objects.exclude(status=ProductStatus.ACTIVE).count()
        if count == 0:
            self.stdout.write(self.style.SUCCESS("All products are already active."))
            return
        if not options["yes"]:
            self.stdout.write(f"This will set {count} product(s) to active.")
            confirm = input("Type 'yes' to continue: ").strip().lower()
            if confirm != "yes":
                self.stdout.write("Aborted.")
                return
        updated = Product.objects.exclude(status=ProductStatus.ACTIVE).update(status=ProductStatus.ACTIVE)
        self.stdout.write(self.style.SUCCESS(f"Set {updated} product(s) to active."))
