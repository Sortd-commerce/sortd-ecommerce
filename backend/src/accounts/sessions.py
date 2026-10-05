import re
import secrets
from ipaddress import ip_address

from django.conf import settings
from django.utils import timezone
from ninja_extra import exceptions

from accounts.models import DeviceSession
from core.messages import ErrorMessage

DEVICE_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{8,64}$")


def normalize_device_id(raw: str | None) -> str:
    value = (raw or "").strip()
    if DEVICE_ID_RE.match(value):
        return value
    return secrets.token_urlsafe(18)[:32]


def device_label(user_agent: str) -> str:
    ua = user_agent or ""
    browser = "Browser"
    if "Edg/" in ua:
        browser = "Edge"
    elif "Chrome/" in ua and "Chromium" not in ua:
        browser = "Chrome"
    elif "Firefox/" in ua:
        browser = "Firefox"
    elif "Safari/" in ua:
        browser = "Safari"
    os_name = "unknown OS"
    if "Android" in ua:
        os_name = "Android"
    elif "iPhone" in ua or "iPad" in ua:
        os_name = "iOS"
    elif "Windows" in ua:
        os_name = "Windows"
    elif "Mac OS" in ua or "Macintosh" in ua:
        os_name = "macOS"
    elif "Linux" in ua:
        os_name = "Linux"
    return f"{browser} on {os_name}"


def client_ip(request) -> str | None:
    forwarded = (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
    candidate = forwarded or request.META.get("REMOTE_ADDR") or ""
    try:
        return str(ip_address(candidate))
    except ValueError:
        return None


def _blacklist_jti(jti: str) -> None:
    if not jti:
        return
    try:
        from ninja_jwt.token_blacklist.models import BlacklistedToken, OutstandingToken
    except Exception:
        return
    row = OutstandingToken.objects.filter(jti=jti).first()
    if row is None:
        return
    BlacklistedToken.objects.get_or_create(token=row)


def revoke_session(session: DeviceSession, *, at=None) -> None:
    when = at or timezone.now()
    if session.revoked_at is None:
        session.revoked_at = when
        session.save(update_fields=["revoked_at"])
    _blacklist_jti(session.refresh_jti)


def enforce_session_limit(user, *, keep: DeviceSession) -> None:
    limit = max(1, int(getattr(settings, "MAX_DEVICE_SESSIONS", 2)))
    active = list(
        DeviceSession.objects.filter(user=user, revoked_at__isnull=True).order_by("last_seen_at", "id")
    )
    extras = [row for row in active if row.pk != keep.pk]
    overflow = len(extras) + 1 - limit
    if overflow <= 0:
        return
    for session in extras[:overflow]:
        revoke_session(session)


def open_session(*, user, request, device_id: str | None, refresh_jti: str) -> tuple[DeviceSession, bool]:
    now = timezone.now()
    ua = (request.META.get("HTTP_USER_AGENT") or "")[:400]
    normalized = normalize_device_id(device_id)
    session = DeviceSession.objects.filter(user=user, device_id=normalized).first()
    is_new = session is None or session.revoked_at is not None
    if session is None:
        session = DeviceSession.objects.create(
            user=user,
            device_id=normalized,
            label=device_label(ua),
            user_agent=ua,
            ip_address=client_ip(request),
            refresh_jti=refresh_jti,
            last_seen_at=now,
        )
    else:
        session.label = device_label(ua) or session.label
        session.user_agent = ua or session.user_agent
        session.ip_address = client_ip(request) or session.ip_address
        session.refresh_jti = refresh_jti
        session.last_seen_at = now
        session.revoked_at = None
        session.save(
            update_fields=["label", "user_agent", "ip_address", "refresh_jti", "last_seen_at", "revoked_at"]
        )
    enforce_session_limit(user, keep=session)
    return session, is_new


def require_active_session(*, user, session_id) -> DeviceSession:
    session = DeviceSession.objects.filter(pk=session_id, user=user, revoked_at__isnull=True).first()
    if session is None:
        raise exceptions.AuthenticationFailed(ErrorMessage.UNAUTHORIZED)
    return session


def touch_session(session: DeviceSession, *, request, refresh_jti: str) -> DeviceSession:
    session.refresh_jti = refresh_jti
    session.last_seen_at = timezone.now()
    session.ip_address = client_ip(request) or session.ip_address
    ua = (request.META.get("HTTP_USER_AGENT") or "")[:400]
    if ua:
        session.user_agent = ua
        session.label = device_label(ua)
    session.save(update_fields=["refresh_jti", "last_seen_at", "ip_address", "user_agent", "label"])
    return session
