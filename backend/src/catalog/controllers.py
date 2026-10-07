from django.http import FileResponse, Http404
from ninja import Query
from ninja_extra import ControllerBase, api_controller, route
from ninja_extra.permissions import AllowAny

from catalog.models import Category, Product, ProductStatus
from catalog.queries import active_products, current_report, product_has_lab_report, report_has_passed
from catalog.search import search_suggestions
from catalog.schemas import (
    CategoryOut,
    LabReportOut,
    ProductDetailOut,
    ProductListOut,
    parse_tags,
    serialize_category,
    serialize_image,
    serialize_variant,
)
from catalog.writer import serialize_label, serialize_related
from core.messages import ErrorMessage
from core.pagination import PageQuery, paginate_queryset
from core.responses import ErrorResponse, SuccessResponse, success
from ninja_extra.exceptions import NotFound

_ERROR_RESPONSES = {401: ErrorResponse, 404: ErrorResponse, 422: ErrorResponse}


def _serialize_detail(product: Product) -> dict:
    report = current_report(product)
    label = serialize_label(product)
    nutrition = None
    if label:
        nutrition = {
            "serving_size": label["serving_size"],
            "serving_basis": label["serving_basis"],
            "headline": label["headline"],
            "facts": label["facts"],
        }
    return {
        "id": product.id,
        "title": product.title,
        "slug": product.slug,
        "brand": product.brand,
        "description": product.description,
        "shelf": product.shelf,
        "tags": parse_tags(product.tags),
        "category": serialize_category(product.category),
        "images": [serialize_image(image, position=index) for index, image in enumerate(product.images.all())],
        "variants": [serialize_variant(variant) for variant in product.variants.filter(is_active=True)],
        "nutrition": nutrition,
        "ingredients": label["ingredients"] if label else [],
        "additives": [
            {"name": row.name, "code": row.code, "is_present": row.is_present} for row in product.additives.all()
        ],
        "related": serialize_related(product),
        "label": label,
        "has_passed_report": report_has_passed(report),
        "has_lab_report": product_has_lab_report(report),
    }


def _default_variant(product: Product) -> dict | None:
    active = [variant for variant in product.variants.all() if variant.is_active]
    if not active:
        return None
    variant = min(active, key=lambda row: (row.price, row.id))
    return serialize_variant(variant)


def _serialize_list_item(product: Product) -> dict:
    images = list(product.images.all())
    primary = images[0] if images else None
    prices = [variant.price for variant in product.variants.all() if variant.is_active]
    report = current_report(product)
    return {
        "id": product.id,
        "title": product.title,
        "slug": product.slug,
        "brand": product.brand,
        "tags": parse_tags(product.tags),
        "category": serialize_category(product.category),
        "primary_image": serialize_image(primary, position=0) if primary else None,
        "from_price": f"{min(prices):.2f}" if prices else None,
        "has_passed_report": report_has_passed(report),
        "has_lab_report": product_has_lab_report(report),
        "default_variant": _default_variant(product),
    }


@api_controller("/categories", tags=["Catalog"], auth=None, permissions=[AllowAny], use_unique_op_id=False)
class CategoryController(ControllerBase):
    @route.get("", response={200: SuccessResponse[list[CategoryOut]], **_ERROR_RESPONSES}, summary="List categories")
    def list_categories(self):
        rows = [
            serialize_category(category)
            for category in Category.objects.filter(is_active=True).order_by("sort_order", "name")
        ]
        return success("Categories retrieved.", rows)


@api_controller("/products", tags=["Catalog"], auth=None, permissions=[AllowAny], use_unique_op_id=False)
class ProductController(ControllerBase):
    @route.get("/search", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Search products and categories")
    def search(self, q: str = "", limit: int = 3):
        rows = search_suggestions(q, limit=max(1, min(limit, 8)))
        return success("Search suggestions retrieved.", rows)

    @route.get("", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="List products")
    def list_products(self, query: Query[PageQuery]):
        page = paginate_queryset(
            active_products().order_by("category__sort_order", "category__name", "title"),
            page=query.page,
            page_size=query.page_size,
        )
        page["results"] = [_serialize_list_item(product) for product in page["results"]]
        return success("Products retrieved.", page)

    @route.get(
        "/{slug}",
        response={200: SuccessResponse[ProductDetailOut], **_ERROR_RESPONSES},
        summary="Get a product",
    )
    def retrieve(self, slug: str):
        product = active_products().filter(slug=slug).first()
        if product is None:
            raise NotFound(ErrorMessage.NOT_FOUND)
        return success("Product retrieved.", _serialize_detail(product))

    @route.get(
        "/{slug}/report",
        response={200: SuccessResponse[LabReportOut], **_ERROR_RESPONSES},
        summary="Get the current lab report",
    )
    def report(self, slug: str):
        product = active_products().filter(slug=slug).first()
        if product is None:
            raise NotFound(ErrorMessage.NOT_FOUND)
        report = current_report(product)
        if report is None:
            raise NotFound(ErrorMessage.NOT_FOUND)
        payload = {
            "lab_name": report.lab_name,
            "accreditation": report.accreditation,
            "tested_on": report.tested_on.isoformat(),
            "summary": report.summary,
            "passed": report_has_passed(report),
            "sections": [
                {
                    "key": section.key,
                    "title": section.title,
                    "results": [
                        {
                            "analyte": result.analyte,
                            "detected_value": result.detected_value,
                            "unit": result.unit,
                            "limit_value": result.limit_value,
                            "passed": result.passed,
                        }
                        for result in section.results.all()
                    ],
                }
                for section in report.sections.all()
            ],
        }
        return success("Lab report retrieved.", payload)

    @route.get("/{slug}/report/pdf", summary="Download the current lab report PDF")
    def report_pdf(self, slug: str):
        product = Product.objects.filter(slug=slug, status=ProductStatus.ACTIVE).first()
        if product is None:
            raise Http404()
        report = current_report(product)
        if report is None or not report.pdf:
            raise Http404()
        return FileResponse(report.pdf.open("rb"), as_attachment=True, filename=report.pdf.name.split("/")[-1])
