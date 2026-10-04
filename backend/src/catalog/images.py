"""Keep gallery order: first image is always the primary photo."""

from catalog.models import ImageRole, Product, ProductImage


def ordered_images(product: Product):
    return list(product.images.order_by("sort_order", "id"))


def sync_image_order(product: Product) -> None:
    for index, image in enumerate(ordered_images(product)):
        role = ImageRole.PRIMARY if index == 0 else ImageRole.SECONDARY
        if image.sort_order == index and image.role == role:
            continue
        image.sort_order = index
        image.role = role
        image.save(update_fields=["sort_order", "role"])


def apply_image_order(product: Product, image_ids: list[int]) -> None:
    rows = ordered_images(product)
    by_id = {row.id: row for row in rows}
    if not image_ids or set(image_ids) != set(by_id):
        raise ValueError("Image order must include every gallery image exactly once.")
    for index, image_id in enumerate(image_ids):
        image = by_id[image_id]
        role = ImageRole.PRIMARY if index == 0 else ImageRole.SECONDARY
        if image.sort_order == index and image.role == role:
            continue
        image.sort_order = index
        image.role = role
        image.save(update_fields=["sort_order", "role"])


def make_image_first(product: Product, image: ProductImage) -> None:
    rest = [row for row in ordered_images(product) if row.id != image.id]
    image.sort_order = 0
    image.role = ImageRole.PRIMARY
    image.save(update_fields=["sort_order", "role"])
    for index, row in enumerate(rest, start=1):
        row.sort_order = index
        row.role = ImageRole.SECONDARY
        row.save(update_fields=["sort_order", "role"])
