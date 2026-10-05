from django.contrib.auth import get_user_model
from django.db.models import Q

ROLE_ADMIN = "admin"
ROLE_MEMBER = "member"
STAFF_ROLES = frozenset({ROLE_ADMIN, ROLE_MEMBER})


def role_of(user) -> str:
    if not getattr(user, "is_staff", False):
        return ""
    if getattr(user, "is_superuser", False):
        return ROLE_ADMIN
    role = (getattr(user, "staff_role", "") or "").strip()
    if role == ROLE_MEMBER:
        return ROLE_MEMBER
    return ROLE_ADMIN


def is_admin(user) -> bool:
    return role_of(user) == ROLE_ADMIN


def serialize_staff(user) -> dict:
    return {
        "id": user.pk,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": role_of(user),
        "is_active": user.is_active,
    }


def admin_queryset():
    User = get_user_model()
    return User.objects.filter(is_staff=True, is_active=True).filter(
        Q(is_superuser=True) | Q(staff_role=ROLE_ADMIN) | Q(staff_role="")
    )
