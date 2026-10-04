from html import escape
from urllib.parse import parse_qs, unquote, urlparse
import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.encoding import force_bytes, force_str

logger = logging.getLogger(__name__)

FOREST = "#16382c"
CITRUS = "#c45c26"
PAPER = "#f4f6f4"
SAND = "#eef1ee"
INK = "#0e1a14"
LINE = "#c9d1cb"


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


def _shop_url() -> str:
    return settings.FRONTEND_URL.rstrip("/")


def _branded_html(*, preview: str, heading: str, intro: str, extra_html: str = "", cta_label: str = "", cta_url: str = "") -> str:
    preview_safe = escape(preview)
    heading_safe = escape(heading)
    intro_safe = escape(intro).replace("\n", "<br>")
    button = ""
    if cta_label and cta_url:
        safe_url = escape(cta_url, quote=True)
        button = (
            f'<p style="margin:28px 0 8px;">'
            f'<a href="{safe_url}" style="display:inline-block;background:{FOREST};color:#ffffff;'
            f"font-family:Arial,sans-serif;font-size:16px;font-weight:700;text-decoration:none;"
            f'padding:14px 22px;border-radius:8px;">{escape(cta_label)}</a></p>'
            f'<p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#5b675f;word-break:break-all;">'
            f'<a href="{safe_url}" style="color:{FOREST};">{escape(cta_url)}</a></p>'
        )
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>{heading_safe}</title></head>
<body style="margin:0;padding:0;background:{PAPER};color:{INK};">
<div style="display:none;max-height:0;overflow:hidden;">{preview_safe}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PAPER};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <tr><td style="padding:8px 8px 20px;font-family:Georgia,serif;font-size:28px;letter-spacing:0.08em;color:{FOREST};">SORTD</td></tr>
      <tr><td style="background:#ffffff;border:1px solid {LINE};border-radius:18px;padding:32px 28px;">
        <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:{CITRUS};">Only what passes</p>
        <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:28px;line-height:1.2;color:{FOREST};">{heading_safe}</h1>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:{INK};">{intro_safe}</p>
        {extra_html}
        {button}
      </td></tr>
      <tr><td style="padding:18px 8px 0;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#7a847e;">
        Sortd · lab-checked labels. If you did not expect this email, you can ignore it.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""


class DjangoEmailSender:
    def send_verification(self, *, to: str, link: str, first_name: str = "") -> None:
        name = first_name.strip() or "there"
        subject = "Confirm your Sortd email"
        body = (
            f"Hi {name},\n\n"
            "Welcome to Sortd. Confirm your account by opening this link:\n"
            f"{link}\n\n"
            "If you did not create an account, ignore this email."
        )
        html = _branded_html(
            preview="Confirm your Sortd account to start shopping lab-checked products.",
            heading=f"Hi {name}, confirm your email",
            intro="Thanks for joining Sortd. Open the button below to verify your address and shop products that pass our label checks.",
            cta_label="Verify email",
            cta_url=link,
        )
        self._send(to=to, subject=subject, body=body, html=html)

    def send_password_reset(self, *, to: str, link: str, first_name: str = "") -> None:
        name = first_name.strip() or "there"
        subject = "Reset your Sortd password"
        body = (
            f"Hi {name},\n\n"
            "Reset your Sortd password with this link:\n"
            f"{link}\n\n"
            "If you did not ask for a reset, you can ignore this email."
        )
        html = _branded_html(
            preview="Use this link to choose a new Sortd password.",
            heading="Reset your password",
            intro=f"Hi {name}, we received a request to reset the password on this Sortd account. The link expires in one hour.",
            cta_label="Choose a new password",
            cta_url=link,
        )
        self._send(to=to, subject=subject, body=body, html=html)

    def send_order_confirmation(self, *, to: str, order: dict, first_name: str = "") -> None:
        name = first_name.strip() or "there"
        number = order.get("number") or ""
        total = order.get("total") or "0.00"
        delivery = order.get("delivery_date") or ""
        subject = f"Order {number} confirmed"
        lines = order.get("lines") or []
        text_lines = "\n".join(
            f"- {row.get('title')} × {row.get('quantity')} — AED {row.get('line_total')}" for row in lines
        )
        address = (order.get("address") or {}).get("formatted_address") or (order.get("address") or {}).get("line1") or ""
        body = (
            f"Hi {name},\n\n"
            f"We received your Sortd order {number}.\n"
            f"Total: AED {total}\n"
            f"Delivery: {delivery}\n"
            f"{text_lines}\n\n"
            f"Delivering to: {address}\n"
            "Payment: cash on delivery."
        )
        rows_html = "".join(
            (
                "<tr>"
                f'<td style="padding:8px 0;border-bottom:1px solid {LINE};font-family:Arial,sans-serif;font-size:14px;">{escape(str(row.get("title") or ""))}</td>'
                f'<td style="padding:8px 0;border-bottom:1px solid {LINE};font-family:Arial,sans-serif;font-size:14px;text-align:center;">{escape(str(row.get("quantity") or ""))}</td>'
                f'<td style="padding:8px 0;border-bottom:1px solid {LINE};font-family:Arial,sans-serif;font-size:14px;text-align:right;">AED {escape(str(row.get("line_total") or ""))}</td>'
                "</tr>"
            )
            for row in lines
        )
        extra = (
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">'
            '<tr style="color:#5b675f;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">'
            '<td style="padding-bottom:8px;">Item</td><td style="padding-bottom:8px;text-align:center;">Qty</td>'
            '<td style="padding-bottom:8px;text-align:right;">Total</td></tr>'
            f"{rows_html}</table>"
            f'<p style="margin:18px 0 0;font-family:Arial,sans-serif;font-size:16px;font-weight:700;color:{FOREST};">AED {escape(str(total))}</p>'
            f'<p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:14px;color:{INK};">Delivery {escape(str(delivery))}<br>{escape(str(address))}</p>'
            '<p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:14px;color:#5b675f;">Cash on delivery.</p>'
        )
        html = _branded_html(
            preview=f"Order {number} is in. Total AED {total}.",
            heading=f"Order {number} is confirmed",
            intro=f"Hi {name}, thanks for shopping with Sortd. We will pack only what passed our checks.",
            extra_html=extra,
            cta_label="View order",
            cta_url=f"{_shop_url()}/orders/{number}",
        )
        self._send(to=to, subject=subject, body=body, html=html)

    def _send(self, *, to: str, subject: str, body: str, html: str) -> None:
        try:
            message = UnquotedAlternatives(
                subject=subject,
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
