"""Shared API response envelope."""

from typing import Any, Generic, Literal, TypeVar

from ninja import Schema
from pydantic import Field

T = TypeVar("T")


class FieldError(Schema):
    field: str | None = None
    message: str
    code: str | None = None


class ErrorResponse(Schema):
    status: Literal["error"] = "error"
    message: str
    code: str = "error"
    errors: list[FieldError] = Field(default_factory=list)


class SuccessResponse(Schema, Generic[T]):
    status: Literal["success"] = "success"
    message: str
    data: T


def success(message: str, data: Any) -> dict[str, Any]:
    return {
        "status": "success",
        "message": message,
        "data": data,
    }


def error(
    message: str,
    code: str = "error",
    errors: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "status": "error",
        "message": message,
        "code": code,
        "errors": errors or [],
    }
