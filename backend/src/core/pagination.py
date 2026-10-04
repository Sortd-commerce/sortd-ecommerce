"""Pagination helpers for list endpoints."""

from typing import Any, Generic, TypeVar

from django.conf import settings
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from ninja import Schema
from ninja_extra.exceptions import NotFound
from ninja_extra.pagination import PageNumberPaginationExtra

from core.messages import ErrorMessage

T = TypeVar("T")


class PageQuery(Schema):
    page: int = 1
    page_size: int | None = None


class PaginatedData(Schema, Generic[T]):
    count: int
    page: int
    page_size: int
    pages: int
    results: list[T]


class AppPageNumberPagination(PageNumberPaginationExtra):
    """Page-number pagination using the project page size settings."""

    def __init__(self, page_size: int | None = None, max_page_size: int | None = None, **kwargs: Any) -> None:
        super().__init__(
            page_size=page_size or settings.PAGE_SIZE,
            max_page_size=max_page_size or settings.MAX_PAGE_SIZE,
            **kwargs,
        )


def paginate_queryset(queryset, *, page: int = 1, page_size: int | None = None) -> dict[str, Any]:
    """Paginate a queryset or sequence and return a stable page payload.

    Use this from a controller or service when you want the page shape without
    the Ninja ``@paginate`` decorator.
    """

    size = _bounded_page_size(page_size)
    if page < 1:
        raise NotFound(ErrorMessage.NOT_FOUND)

    paginator = Paginator(queryset, size)
    try:
        current = paginator.page(page)
    except (EmptyPage, PageNotAnInteger) as exc:
        raise NotFound(ErrorMessage.NOT_FOUND) from exc

    return {
        "count": paginator.count,
        "page": current.number,
        "page_size": size,
        "pages": paginator.num_pages if paginator.count else 0,
        "results": list(current.object_list),
    }


def _bounded_page_size(page_size: int | None) -> int:
    size = settings.PAGE_SIZE if page_size is None else page_size
    if size < 1:
        raise NotFound(ErrorMessage.NOT_FOUND)
    return min(size, settings.MAX_PAGE_SIZE)
