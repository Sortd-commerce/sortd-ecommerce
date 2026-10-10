"""Upload hero images for shop aisles (from stock URLs) to category.image."""

from django.core.management.base import BaseCommand

from catalog.excel_importer import AISLE_TO_CATEGORY
from catalog.image_fetch import ImageFetchError, load_image
from catalog.models import Category, Product
from catalog.schemas import image_url

# Pexels (free to use) — representative aisle heroes.
AISLE_HERO_URLS: dict[str, str] = {
    "Breakfast & spreads": "https://images.pexels.com/photos/1076885/pexels-photo-1076885.jpeg?auto=compress&cs=tinysrgb&w=900",
    "Snacks & bars": "https://images.pexels.com/photos/1893556/pexels-photo-1893556.jpeg?auto=compress&cs=tinysrgb&w=900",
    "Chocolate": "https://images.pexels.com/photos/3251400/pexels-photo-3251400.jpeg?auto=compress&cs=tinysrgb&w=900",
    "Drinks": "https://images.pexels.com/photos/143133/pexels-photo-143133.jpeg?auto=compress&cs=tinysrgb&w=900",
    "Pantry": "https://images.pexels.com/photos/264636/pexels-photo-264636.jpeg?auto=compress&cs=tinysrgb&w=900",
}


def _fallback_url_for_aisle(slug: str) -> str:
    product = (
        Product.objects.filter(category__slug=slug, images__isnull=False)
        .distinct()
        .prefetch_related("images")
        .order_by("title")
        .first()
    )
    if product is None:
        return ""
    primary = product.images.order_by("sort_order", "id").first()
    return image_url(primary) if primary else ""


class Command(BaseCommand):
    help = "Fetch stock aisle hero images and store them on Category.image (Cloudinary when configured)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Replace existing category hero images.",
        )

    def handle(self, *args, **options):
        force = options["force"]
        updated = 0
        for aisle, (_name, slug, _sort) in AISLE_TO_CATEGORY.items():
            url = AISLE_HERO_URLS.get(aisle)
            if not url:
                self.stdout.write(self.style.WARNING(f"No stock URL configured for aisle {aisle!r}."))
                continue
            category = Category.objects.filter(slug=slug).first()
            if category is None:
                self.stdout.write(self.style.WARNING(f"Category missing: {slug}"))
                continue
            if category.image and not force:
                self.stdout.write(f"Skip {aisle} (already has image).")
                continue
            try:
                content, filename, _size = load_image(url)
            except ImageFetchError as exc:
                fallback = _fallback_url_for_aisle(slug)
                if not fallback:
                    self.stderr.write(self.style.ERROR(f"{aisle}: {exc}"))
                    continue
                self.stdout.write(self.style.WARNING(f"{aisle}: stock URL failed, using catalog product image."))
                content, filename, _size = load_image(fallback)
            if category.image:
                category.image.delete(save=False)
            category.image.save(filename, content, save=True)
            updated += 1
            self.stdout.write(self.style.SUCCESS(f"Updated {aisle}: {category.image.url or category.image.name}"))

        self.stdout.write(self.style.SUCCESS(f"Done. {updated} aisle image(s) updated."))
