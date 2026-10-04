from django.http import HttpRequest

from ninja_extra.permissions import BasePermission


class IsStaff(BasePermission):
    """Authenticated staff user required for admin API routes."""

    message = "Staff credentials are required."

    def has_permission(self, request: HttpRequest, controller) -> bool:
        user = request.user or request.auth
        return bool(user and user.is_authenticated and user.is_staff)
