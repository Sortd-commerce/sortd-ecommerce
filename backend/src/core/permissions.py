from django.http import HttpRequest

from ninja_extra.permissions import BasePermission

from accounts.staff import is_admin


class IsStaff(BasePermission):
    """Authenticated staff user required for admin API routes."""

    message = "Staff credentials are required."

    def has_permission(self, request: HttpRequest, controller) -> bool:
        user = request.user or request.auth
        return bool(user and user.is_authenticated and user.is_staff)


class IsAdminStaff(IsStaff):
    """Full console access. Members can only view orders."""

    message = "Admin credentials are required."

    def has_permission(self, request: HttpRequest, controller) -> bool:
        if not super().has_permission(request, controller):
            return False
        user = request.user or request.auth
        return is_admin(user)

