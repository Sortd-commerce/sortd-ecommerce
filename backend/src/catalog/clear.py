"""Remove catalog and transactional commerce data while keeping users."""

from __future__ import annotations

from dataclasses import dataclass

from catalog.models import Category, LabReport, Product, ProductImage
from commerce.models import CartItem, Discount, Order


@dataclass(frozen=True)
class CatalogClearResult:
    orders: int
    cart_items: int
    discounts: int
    products: int
    categories: int


def clear_catalog_data(*, delete_media: bool = True) -> CatalogClearResult:
    """Delete products, categories, orders, carts, and product-scoped discounts."""
    if delete_media:
        for image in ProductImage.objects.exclude(file="").iterator():
            image.file.delete(save=False)
        for category in Category.objects.exclude(image="").iterator():
            category.image.delete(save=False)
        for report in LabReport.objects.exclude(pdf="").iterator():
            report.pdf.delete(save=False)

    cart_items = CartItem.objects.count()
    CartItem.objects.all().delete()

    orders = Order.objects.count()
    Order.objects.all().delete()

    discounts = Discount.objects.count()
    Discount.objects.all().delete()

    products = Product.objects.count()
    Product.objects.all().delete()

    categories = Category.objects.count()
    Category.objects.all().delete()

    return CatalogClearResult(
        orders=orders,
        cart_items=cart_items,
        discounts=discounts,
        products=products,
        categories=categories,
    )
