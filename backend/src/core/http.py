"""Health and guaranteed staff-session HTTP views.

Ninja Extra can miss controller routes under /api/v1/admin/; Django then
renders an HTML 404 and the Next.js admin shows "Request failed".
These paths are registered before the Ninja include so they always resolve.
"""

from django.http import HttpRequest, HttpResponse, JsonResponse
from django.views.defaults import page_not_found
from ninja_jwt.exceptions import AuthenticationFailed, InvalidToken

from accounts.auth import SessionJWTAuth
from accounts.staff import is_staff_user, serialize_staff
from core.messages import ErrorMessage
from core.responses import error, success


def healthz(_request: HttpRequest) -> JsonResponse:
    return JsonResponse({"status": "ok"})


def json_error(message: str, code: str, status: int) -> JsonResponse:
    return JsonResponse(error(message, code), status=status)


def staff_me(request: HttpRequest) -> JsonResponse:
    header = request.headers.get("Authorization") or ""
    if not header.lower().startswith("bearer "):
        return json_error(ErrorMessage.UNAUTHORIZED, "unauthorized", 401)
    token = header.split(" ", 1)[1].strip()
    if not token:
        return json_error(ErrorMessage.UNAUTHORIZED, "unauthorized", 401)
    try:
        user = SessionJWTAuth().jwt_authenticate(request, token)
    except (InvalidToken, AuthenticationFailed):
        return json_error(ErrorMessage.UNAUTHORIZED, "unauthorized", 401)
    if user is None:
        return json_error(ErrorMessage.UNAUTHORIZED, "unauthorized", 401)
    request.user = user
    if not is_staff_user(user):
        return json_error("Staff credentials are required.", "forbidden", 403)
    return JsonResponse(success("Staff profile retrieved.", serialize_staff(user)))


def api_or_html_404(request: HttpRequest, exception) -> HttpResponse:
    if request.path.startswith("/api/"):
        return json_error(ErrorMessage.NOT_FOUND, "not_found", 404)
    return page_not_found(request, exception)
