from html import escape
from urllib.parse import parse_qs, unquote, urlparse
import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.encoding import force_bytes, force_str

logger = logging.getLogger(__name__)


class EmailSendError(Exception):
    pass


def unwrap_verification_token(raw: str) -> str:
    """Undo quoted-printable copy/paste and accept a full magic-link URL."""
    text = (raw or "").replace("=\r\n", "").replace("=\n", "").replace("=\r", "")
    text = "".join(text.split())
    text = text.replace("=3D", "=").replace("=3d", "=")
    if "token=" in text.lower():
        candidate = text if "://" in text else f"http://local/?{text.lstrip('?')}"
        extracted = parse_qs(urlparse(candidate).query).get("token", [""])[0]
        text = unquote(extracted) or text
    if text[:2].lower() == "3d":
        text = text[2:]
    return text.replace("=", "")


class UnquotedAlternatives(EmailMultiAlternatives):
    """Keep '=' in magic links as '=' instead of quoted-printable '=3D'."""

    def _add_bodies(self, msg):
        encoding = self.encoding or settings.DEFAULT_CHARSET
        body = force_str(self.body or "", encoding=encoding, errors="surrogateescape")
        msg.set_content(body, subtype=self.content_subtype, charset=encoding, cte="8bit")
        if self.alternatives:
            msg.make_alternative()
            for alternative in self.alternatives:
                maintype, subtype = alternative.mimetype.split("/", 1)
                content = alternative.content
                if maintype == "text":
                    if isinstance(content, bytes):
                        content = content.decode()
                    msg.add_alternative(content, subtype=subtype, charset=encoding, cte="8bit")
                else:
                    msg.add_alternative(
                        force_bytes(content, encoding=encoding, strings_only=True),
                        maintype=maintype,
                        subtype=subtype,
                    )
        return msg


class DjangoEmailSender:
    def send_verification(self, *, to: str, link: str) -> None:
        body = (
            "Confirm your Sortd account by opening this link:\n"
            f"{link}\n\n"
            "If you did not request this, ignore this email."
        )
        safe_link = escape(link, quote=True)
        html = (
            "<p>Confirm your Sortd account.</p>"
            f'<p><a href="{safe_link}">Verify your email</a></p>'
            f"<p>{safe_link}</p>"
            "<p>If you did not request this, ignore this email.</p>"
        )
        try:
            message = UnquotedAlternatives(
                subject="Verify your Sortd email",
                body=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[to],
            )
            message.attach_alternative(html, "text/html")
            sent = message.send(using="default")
        except Exception as exc:
            logger.exception("Email send failed")
            raise EmailSendError(_send_failure_message(exc)) from exc
        if not sent:
            raise EmailSendError("Unable to send email.")


def _send_failure_message(exc: BaseException) -> str:
    response = getattr(exc, "response", None)
    if response is not None:
        try:
            errors = response.json().get("errors") or []
            if errors:
                return " ".join(str(item) for item in errors)
        except Exception:
            pass
    return "Unable to send email. Please try again."
