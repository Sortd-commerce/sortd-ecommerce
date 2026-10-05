from django.contrib.auth.models import AnonymousUser
from django.http import HttpRequest

from ninja_extra.permissions import BasePermission

from accounts.staff import is_admin, is_staff_user


def authenticated_user(request: HttpRequest):
    """Prefer the JWT principal. Django's AnonymousUser is truthy, so `user or auth` is wrong."""
    for candidate in (getattr(request, "auth", None), getattr(request, "user", None)):
        if candidate is None or isinstance(candidate, AnonymousUser):
            continue
        if getattr(candidate, "is_authenticated", False):
            return candidate
    return None


class IsStaff(BasePermission):
    """Authenticated staff user required for admin API routes."""

    message = "Staff credentials are required."

    def has_permission(self, request: HttpRequest, controller) -> bool:
        return is_staff_user(authenticated_user(request))


class IsAdminStaff(IsStaff):
    """Full console access. Members can only view orders."""

    message = "Admin credentials are required."

    def has_permission(self, request: HttpRequest, controller) -> bool:
        if not super().has_permission(request, controller):
            return False
        return is_admin(authenticated_user(request))
