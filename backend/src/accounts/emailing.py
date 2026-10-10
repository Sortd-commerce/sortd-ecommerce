from html import escape
from urllib.parse import parse_qs, unquote, urlparse
import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.encoding import force_bytes, force_str

logger = logging.getLogger(__name__)

FOREST = "#143503"
CITRUS = "#c45c26"
STOP = "#e23b32"
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


_WORDMARK_PATH = (
    "M70.9534 187.825C81.9906 187.825 91.6482 186.485 99.9261 183.804C108.204 181.124 115.496 177.3 "
    "121.803 172.334C127.559 167.84 132.131 162.203 135.521 155.423C137.997 150.464 139.569 145.379 "
    "140.239 140.168C141.091 143.952 142.285 147.559 143.823 150.988C147.291 158.754 152.022 165.278 "
    "158.013 170.56C164.241 176.078 171.396 180.217 179.477 182.977C187.558 185.736 196.407 187.116 "
    "206.025 187.116C217.141 187.116 227.016 185.539 235.648 182.385C244.281 179.232 251.711 174.699 "
    "257.939 168.786C263.773 163.267 268.208 156.625 271.243 148.86C274.278 141.094 275.796 132.836 "
    "275.796 124.085C275.796 115.255 274.259 107.056 271.184 99.488C268.109 91.9197 263.655 85.4156 "
    "257.821 79.9758C251.83 74.4572 244.636 70.1803 236.239 67.1451C227.843 64.1099 218.127 62.5923 "
    "207.089 62.5923C196.525 62.5923 186.966 64.1099 178.412 67.1451C169.859 70.1803 162.665 74.4572 "
    "156.831 79.9758C150.76 85.731 146.207 92.2942 143.172 99.6654C140.689 105.696 139.219 112.425 "
    "138.761 119.852C137.287 114.499 134.926 109.701 131.678 105.46C125.726 97.6945 117.034 91.6043 "
    "105.602 87.1894C100.872 85.3762 95.4718 83.4841 89.4013 81.5132C83.3309 79.5422 77.3787 77.5713 "
    "71.5447 75.6004C61.6112 72.3681 54.2991 68.6233 49.6083 64.3661C44.9175 60.1089 42.5721 54.6297 "
    "42.5721 47.9285C42.5721 40.8332 45.2722 34.881 50.6726 30.0719C56.0729 25.2629 63.0303 22.8583 "
    "71.5447 22.8583C78.3247 22.8583 84.2375 24.2183 89.2831 26.9382C94.3287 29.658 98.783 33.3042 "
    "102.646 37.8768C106.194 42.134 109.564 47.4752 112.757 53.9005C115.95 60.3257 118.729 66.6129 "
    "121.094 72.7622H131.264L130.318 15.5265H120.03L112.816 22.6218C108.165 20.0202 101.779 17.4383 "
    "93.6585 14.8761C85.5383 12.3139 76.8268 11.0328 67.524 11.0328C57.9847 11.0328 49.155 12.4518 "
    "41.0347 15.29C32.9145 18.1281 26.2528 21.794 21.0495 26.2877C15.6098 31.0968 11.4708 36.5169 "
    "8.63267 42.5479C5.79453 48.5789 4.37546 54.8662 4.37546 61.4097C4.37546 71.7374 7.11505 81.0796 "
    "12.5942 89.4363C18.0734 97.793 26.4499 104.218 37.7236 108.712C42.6115 110.604 47.8344 112.457 "
    "53.3925 114.27C58.9505 116.083 65.0407 118.054 71.663 120.183C81.833 123.415 89.3422 127.258 "
    "94.1907 131.713C99.0392 136.167 101.463 141.666 101.463 148.209C101.463 156.172 98.6056 162.775 "
    "92.8899 168.017C87.1742 173.26 78.9554 175.881 68.2336 175.881C60.271 175.881 53.3136 174.226 "
    "47.3614 170.915C41.4092 167.603 36.0286 163.307 31.2195 158.025C26.5681 152.979 22.4686 147.263 "
    "18.9209 140.878C15.3732 134.492 12.4563 128.421 10.17 122.666H0L1.53732 183.331H11.5891L19.7487 "
    "175.053C25.898 178.522 33.4072 181.518 42.2764 184.041C51.1456 186.564 60.7046 187.825 70.9534 "
    "187.825ZM608.024 180.848V172.215C605.974 172.136 603.353 171.9 600.16 171.506C596.967 171.112 "
    "594.543 170.481 592.887 169.614C590.68 168.431 589.083 166.815 588.098 164.765C587.112 162.715 "
    "586.619 160.193 586.619 157.197V2.16358L584.846 0.271484L520.987 3.34613V11.9788C524.693 12.2942 "
    "528.378 12.8263 532.044 13.5753C535.71 14.3242 538.765 15.5659 541.209 17.3003C543.18 18.7194 "
    "544.757 20.71 545.939 23.2722C547.122 25.8344 547.713 28.574 547.713 31.491V70.1606C544.323 "
    "68.1897 539.79 66.475 534.114 65.0165C528.438 63.558 522.367 62.8288 515.902 62.8288C499.504 "
    "62.8288 485.53 68.781 473.981 80.6854C462.431 92.5898 456.656 106.859 456.656 123.494C456.656 "
    "142.257 461.82 157.552 472.148 169.377C482.476 181.203 495.602 187.116 511.527 187.116C518.228 "
    "187.116 524.87 185.559 531.453 182.444C538.036 179.33 543.259 175.684 547.122 171.506L547.95 "
    "171.742V182.622L549.724 184.277L608.024 180.848ZM389.452 87.6625C389.452 84.6272 389.053 81.8285 "
    "388.257 79.2663H392.668V151.875C392.668 162.991 395.644 171.545 401.596 177.537C407.549 183.528 "
    "416.674 186.524 428.973 186.524C437.251 186.524 444.267 185.637 450.022 183.863C455.777 182.09 "
    "461.178 180.099 466.223 177.892V167.958C464.725 168.352 462.084 168.707 458.3 169.022C454.516 "
    "169.338 451.56 169.495 449.431 169.495C442.809 169.495 438.216 167.564 435.654 163.701C433.092 "
    "159.838 431.811 153.294 431.811 144.07V79.2663H464.686V66.4947H431.574V30.6632H393.141V66.4947H"
    "378.135C374.461 64.3661 370.113 63.3018 365.091 63.3018C358.469 63.3018 352.103 65.0953 345.993 "
    "68.6824C339.883 72.2695 334.108 77.2165 328.668 83.5235H328.195V66.3764L326.421 64.6026L270.013 "
    "67.6772V76.3099C272.615 76.5464 275 76.98 277.168 77.6107C279.336 78.2414 281.129 79.0298 282.548 "
    "79.9758C284.441 81.3161 286.057 83.1096 287.397 85.3565C288.737 87.6033 289.407 90.1458 289.407 "
    "92.984V161.809C289.407 164.726 288.934 167.091 287.988 168.904C287.042 170.717 285.308 172.058 "
    "282.785 172.925C281.366 173.398 279.651 173.772 277.641 174.048C275.63 174.324 273.64 174.541 "
    "271.669 174.699V183.331H350.782V174.699C349.048 174.62 346.229 174.285 342.327 173.694C338.424 "
    "173.102 335.606 172.373 333.871 171.506C331.822 170.481 330.363 169.062 329.496 167.249C328.629 "
    "165.435 328.195 163.149 328.195 160.39V95.4673C331.27 91.5255 334.817 88.372 338.838 86.0069C"
    "342.859 83.6418 346.682 82.3804 350.309 82.2227C349.994 83.5629 349.639 85.0017 349.245 86.539C"
    "348.85 88.0764 348.653 90.2247 348.653 92.984C348.653 98.6602 350.644 102.957 354.625 105.874C"
    "358.607 108.791 363.475 110.249 369.23 110.249C375.3 110.249 380.188 107.983 383.894 103.45C"
    "387.599 98.9165 389.452 93.6541 389.452 87.6625ZM227.548 161.927C225.577 167.051 222.896 170.934 "
    "219.506 173.575C216.116 176.216 212.056 177.537 207.326 177.537C202.123 177.537 197.826 176.118 "
    "194.436 173.28C191.046 170.441 188.444 166.578 186.631 161.691C184.503 156.014 183.162 150.358 "
    "182.611 144.721C182.059 139.084 181.783 131.969 181.783 123.376C181.783 116.832 182.098 110.545 "
    "182.729 104.514C183.359 98.4829 184.503 93.2205 186.158 88.7268C187.971 83.8389 190.553 79.8576 "
    "193.904 76.7829C197.255 73.7083 201.729 72.171 207.326 72.171C212.45 72.171 216.688 73.59 220.038 "
    "76.4282C223.389 79.2663 226.01 83.1687 227.902 88.1355C229.479 92.235 230.662 97.8325 231.45 "
    "104.928C232.238 112.023 232.633 118.33 232.633 123.849C232.633 132.205 232.219 139.537 231.391 "
    "145.844C230.563 152.151 229.282 157.512 227.548 161.927ZM547.713 159.798C545.033 162.873 542.116 "
    "165.337 538.962 167.189C535.809 169.042 531.828 169.968 527.018 169.968C521.973 169.968 517.657 "
    "168.786 514.07 166.421C510.482 164.056 507.546 160.784 505.259 156.606C502.973 152.427 501.377 "
    "147.796 500.47 142.711C499.563 137.626 499.11 131.89 499.11 125.504C499.11 109.264 501.633 96.6893 "
    "506.679 87.7807C511.724 78.8721 518.189 74.4178 526.072 74.4178C529.384 74.4178 532.36 75.0485 "
    "535.001 76.3099C537.642 77.5713 539.751 79.0298 541.327 80.6854C543.062 82.6563 544.422 84.7455 "
    "545.407 86.9529C546.393 89.1604 547.161 91.1707 547.713 92.984V159.798Z"
)
_STOP_DOT_PATH = "M616.35 183.331H640.001V159.68H616.35V183.331Z"


def _email_logo_html() -> str:
    shop = escape(_shop_url(), quote=True)
    logo_url = escape(f"{_shop_url()}/images/sortd-wordmark.png", quote=True)
    return (
        f'<tr><td style="padding:8px 8px 20px;">'
        f'<a href="{shop}" style="text-decoration:none;display:inline-block;">'
        f'<img src="{logo_url}" alt="Sortd" width="148" height="44" '
        f'style="display:block;border:0;outline:none;text-decoration:none;max-width:148px;height:auto;" />'
        f"</a>"
        f"</td></tr>"
    )


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
      {_email_logo_html()}
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

    def send_auth_code(self, *, to: str, code: str, first_name: str = "", purpose: str = "signup") -> None:
        name = first_name.strip() or "there"
        if purpose == "login":
            subject = "Your Sortd login code"
            preview = "Use this code to sign in to Sortd."
            heading = "Your login code"
            intro = f"Hi {name}, enter this code on Sortd to sign in. It expires in 10 minutes."
        else:
            subject = "Your Sortd verification code"
            preview = "Use this code to finish creating your Sortd account."
            heading = "Your verification code"
            intro = f"Hi {name}, enter this code on Sortd to verify your email and create your account. It expires in 10 minutes."
        code_html = (
            f'<p style="margin:24px 0 0;font-family:Arial,sans-serif;font-size:32px;letter-spacing:0.35em;'
            f'font-weight:700;color:{FOREST};">{escape(code)}</p>'
        )
        body = f"Hi {name},\n\nYour Sortd code is {code}.\n\nIt expires in 10 minutes.\n"
        html = _branded_html(
            preview=preview,
            heading=heading,
            intro=intro,
            extra_html=code_html,
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

    def send_order_cancellation(self, *, to: str, order: dict, first_name: str = "") -> None:
        name = first_name.strip() or "there"
        number = order.get("number") or ""
        total = order.get("total") or "0.00"
        delivery = order.get("delivery_date") or ""
        subject = f"Order {number} cancelled"
        lines = order.get("lines") or []
        text_lines = "\n".join(
            f"- {row.get('title')} × {row.get('quantity')} — AED {row.get('line_total')}" for row in lines
        )
        body = (
            f"Hi {name},\n\n"
            f"Your Sortd order {number} has been cancelled.\n"
            f"Total: AED {total}\n"
            f"Was scheduled for: {delivery}\n"
            f"{text_lines}\n\n"
            "If you did not request this cancellation, contact us."
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
            f'<p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:14px;color:{INK};">Was scheduled for {escape(str(delivery))}</p>'
        )
        html = _branded_html(
            preview=f"Order {number} was cancelled.",
            heading=f"Order {number} was cancelled",
            intro=f"Hi {name}, your Sortd order has been cancelled. Any reserved stock has been released.",
            extra_html=extra,
            cta_label="View orders",
            cta_url=f"{_shop_url()}/orders",
        )
        self._send(to=to, subject=subject, body=body, html=html)

    def send_new_device_login(
        self, *, to: str, first_name: str = "", label: str = "", ip_address: str | None = None
    ) -> None:
        name = first_name.strip() or "there"
        where = label or "a new device"
        ip_bit = f" ({ip_address})" if ip_address else ""
        subject = "New device signed in to Sortd"
        body = (
            f"Hi {name},\n\n"
            f"Your Sortd account was just used on {where}{ip_bit}.\n"
            "You can stay signed in on two devices at once. If this was not you, contact us."
        )
        html = _branded_html(
            preview=f"New sign-in from {where}.",
            heading="New device signed in",
            intro=f"Hi {name}, someone just signed in to your Sortd account from {where}{ip_bit}. Two devices can stay signed in at the same time. If this was not you, contact us.",
        )
        self._send(to=to, subject=subject, body=body, html=html)

    def _send(self, *, to: str, subject: str, body: str, html: str) -> None:
        backend = settings.MAILERS["default"]["BACKEND"]
        logger.info(
            "Sending email backend=%s from=%s to=%s subject=%r",
            backend,
            settings.DEFAULT_FROM_EMAIL,
            to,
            subject,
        )
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
            logger.exception(
                "Email send failed backend=%s to=%s subject=%r",
                backend,
                to,
                subject,
            )
            raise EmailSendError(_send_failure_message(exc)) from exc
        if not sent:
            logger.error(
                "Email send returned 0 backend=%s to=%s subject=%r",
                backend,
                to,
                subject,
            )
            raise EmailSendError("Unable to send email.")
        logger.info("Email sent backend=%s to=%s subject=%r", backend, to, subject)


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
