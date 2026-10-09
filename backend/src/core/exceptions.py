"""Normalize API failures into one error envelope."""

import logging
import math

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.http import Http404, HttpRequest, HttpResponse
from ninja.errors import HttpError, ValidationError
from ninja_extra.exceptions import APIException, Throttled

from core.cloudinary_storage import CloudinaryUploadError
from core.messages import ErrorMessage
from core.responses import error

logger = logging.getLogger(__name__)

_STATUS_MESSAGES = {
    401: ErrorMessage.UNAUTHORIZED,
    403: ErrorMessage.FORBIDDEN,
    404: ErrorMessage.NOT_FOUND,
    429: ErrorMessage.THROTTLED,
    503: ErrorMessage.EMAIL_UNAVAILABLE,
}

_STATUS_CODES = {
    400: "invalid",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "invalid",
    429: "throttled",
    503: "unavailable",
}

_SKIP_DETAIL_KEYS = {"detail", "code", "messages"}


class ServiceUnavailable(APIException):
    status_code = 503
    default_detail = ErrorMessage.EMAIL_UNAVAILABLE
    default_code = "unavailable"


class Conflict(APIException):
    status_code = 409
    default_detail = ErrorMessage.CONFLICT
    default_code = "conflict"


def register_exception_handlers(api) -> None:
    @api.exception_handler(APIException)
    def handle_api_exception(request: HttpRequest, exc: APIException) -> HttpResponse:
        status_code = int(exc.status_code)
        message = _message_from_detail(exc.detail, _STATUS_MESSAGES.get(status_code, ErrorMessage.GENERIC))
        code = _code_from_detail(exc.detail, getattr(exc, "default_code", None) or _STATUS_CODES.get(status_code, "error"))
        body = error(message, str(code), _flatten_detail(exc.detail))
        response = api.create_response(request, body, status=status_code)
        if isinstance(exc, Throttled) and exc.wait:
            response["Retry-After"] = str(math.ceil(float(exc.wait)))
        return response

    @api.exception_handler(CloudinaryUploadError)
    def handle_cloudinary_upload(request: HttpRequest, exc: CloudinaryUploadError) -> HttpResponse:
        message = str(exc)
        return api.create_response(
            request,
            error(message, "invalid", [{"field": "file", "message": message}]),
            status=422,
        )

    @api.exception_handler(ValidationError)
    def handle_validation_error(request: HttpRequest, exc: ValidationError) -> HttpResponse:
        errors = [_pydantic_error(item) for item in exc.errors]
        message = errors[0]["message"] if errors else ErrorMessage.VALIDATION
        body = error(message, "invalid", errors)
        return api.create_response(request, body, status=422)

    @api.exception_handler(HttpError)
    def handle_http_error(request: HttpRequest, exc: HttpError) -> HttpResponse:
        status_code = int(exc.status_code)
        message = _STATUS_MESSAGES.get(status_code) or str(exc) or ErrorMessage.GENERIC
        code = _STATUS_CODES.get(status_code, "http_error")
        return api.create_response(request, error(message, code), status=status_code)

    @api.exception_handler(Http404)
    def handle_not_found(request: HttpRequest, exc: Http404) -> HttpResponse:
        return api.create_response(
            request,
            error(ErrorMessage.NOT_FOUND, "not_found"),
            status=404,
        )

    @api.exception_handler(PermissionDenied)
    def handle_permission_denied(request: HttpRequest, exc: PermissionDenied) -> HttpResponse:
        return api.create_response(
            request,
            error(ErrorMessage.FORBIDDEN, "forbidden"),
            status=403,
        )

    @api.exception_handler(Exception)
    def handle_unexpected(request: HttpRequest, exc: Exception) -> HttpResponse:
        logger.exception("Unhandled API exception")
        errors = []
        if settings.DEBUG:
            errors = [{"field": None, "message": str(exc), "code": exc.__class__.__name__}]
        return api.create_response(
            request,
            error(ErrorMessage.GENERIC, "server_error", errors),
            status=500,
        )


def _message_from_detail(detail, fallback: str) -> str:
    if isinstance(detail, dict) and detail.get("detail"):
        return str(detail["detail"])
    if isinstance(detail, dict):
        flattened = _flatten_detail(detail)
        if flattened:
            return str(flattened[0]["message"])
    if isinstance(detail, list) and len(detail) == 1 and not isinstance(detail[0], (dict, list)):
        return str(detail[0])
    if isinstance(detail, (dict, list)):
        return fallback
    if detail:
        return str(detail)
    return fallback


def _code_from_detail(detail, fallback: str) -> str:
    if isinstance(detail, dict) and detail.get("code"):
        return str(detail["code"])
    code = getattr(detail, "code", None)
    if code and not isinstance(detail, (dict, list)):
        return str(code)
    return str(fallback)


def _flatten_detail(detail, field: str | None = None) -> list[dict]:
    if isinstance(detail, dict):
        errors = []
        for key, value in detail.items():
            if key in _SKIP_DETAIL_KEYS:
                continue
            errors.extend(_flatten_detail(value, field=str(key)))
        return errors
    if isinstance(detail, list):
        errors = []
        for item in detail:
            errors.extend(_flatten_detail(item, field=field))
        return errors
    if field is None and isinstance(detail, str):
        return []
    return [
        {
            "field": field,
            "message": str(detail),
            "code": getattr(detail, "code", None),
        }
    ]


_LOCATION_WRAPPERS = {"body", "query", "path", "form", "cookie", "header", "payload", "data"}


_FIELD_LABELS = {
    "full_name": "Name",
    "first_name": "First name",
    "last_name": "Last name",
    "email": "Email",
    "phone": "Phone number",
}


def _friendly_pydantic_message(item: dict, field: str | None) -> str:
    raw = str(item.get("msg") or "").strip()
    error_type = str(item.get("type") or "")
    ctx = item.get("ctx") or {}
    label = _FIELD_LABELS.get(field or "", field or "This field")

    if error_type in {"string_too_long", "too_long"}:
        max_length = ctx.get("max_length")
        if field == "phone":
            return (
                "Phone number is too long. Enter 9 Dubai mobile digits without +971 "
                "(for example, 50 123 4567)."
            )
        if field == "full_name":
            return "Name is too long (use 301 characters or fewer)."
        if field == "email":
            return "Email is too long (use 254 characters or fewer)."
        if max_length is not None:
            return f"{label} must be at most {max_length} characters."

    if error_type in {"string_too_short", "too_short"}:
        min_length = ctx.get("min_length")
        if field == "full_name":
            return "Enter your full name."
        if field == "phone":
            return (
                "Enter a Dubai mobile number: 9 digits starting with 50, 52, 54, 55, 56, or 58 "
                "(for example, 50 123 4567). Without +971."
            )
        if min_length is not None:
            return f"{label} must be at least {min_length} characters."

    if error_type == "missing":
        if field == "full_name":
            return "Enter your full name."
        if field == "email":
            return "Enter your email."
        if field == "phone":
            return "Enter your mobile number."
        return f"{label} is required."

    if raw.startswith("String should have at most") or raw.startswith("String should have at least"):
        return _friendly_pydantic_message({**item, "type": "string_too_long" if "at most" in raw else "string_too_short"}, field)

    return raw or ErrorMessage.VALIDATION


def _pydantic_error(item: dict) -> dict:
    location = item.get("loc") or ()
    parts = [str(part) for part in location if str(part) not in _LOCATION_WRAPPERS]
    field = ".".join(parts) or None
    return {
        "field": field,
        "message": _friendly_pydantic_message(item, field.split(".")[-1] if field else None),
        "code": item.get("type"),
    }
