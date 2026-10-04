"""Django 6 MAILERS map. Local defaults to console; production requires a real sender."""

from django.core.exceptions import ImproperlyConfigured

from config.environment import PRODUCTION

SMTP_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
CONSOLE_BACKEND = "core.console_mail.EmailBackend"
DUMMY_BACKEND = "django.core.mail.backends.dummy.EmailBackend"
FILE_BACKEND = "django.core.mail.backends.filebased.EmailBackend"
LOCMEM_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
BREVO_BACKEND = "anymail.backends.brevo.EmailBackend"

DEVELOPMENT_BACKENDS = {CONSOLE_BACKEND, DUMMY_BACKEND, FILE_BACKEND, LOCMEM_BACKEND}


def build_mailers(
    *,
    environment: str,
    host: str = "",
    port: int = 587,
    username: str = "",
    password: str = "",
    use_tls: bool = True,
    use_ssl: bool = False,
    timeout: int = 10,
    backend: str = "",
    brevo_api_key: str = "",
) -> dict:
    selected = (backend or "").strip().strip('"').strip("'")
    if not selected:
        if brevo_api_key:
            selected = BREVO_BACKEND
        elif environment == PRODUCTION or host:
            selected = SMTP_BACKEND
        else:
            selected = CONSOLE_BACKEND

    if use_ssl and use_tls:
        raise ImproperlyConfigured("Set EMAIL_USE_TLS or EMAIL_USE_SSL, not both.")

    if selected == BREVO_BACKEND and not brevo_api_key:
        raise ImproperlyConfigured("BREVO_API_KEY is required when using the Brevo backend.")

    if environment == PRODUCTION:
        if selected in DEVELOPMENT_BACKENDS:
            raise ImproperlyConfigured(
                "Production email must use SMTP or an ESP backend, not a development backend."
            )
        if selected == SMTP_BACKEND:
            if not host:
                raise ImproperlyConfigured("EMAIL_HOST is required when ENVIRONMENT=production.")
            if not password:
                raise ImproperlyConfigured(
                    "EMAIL_HOST_PASSWORD is required when ENVIRONMENT=production."
                )

    config: dict = {"BACKEND": selected}
    if selected == SMTP_BACKEND:
        config["OPTIONS"] = {
            "host": host or "localhost",
            "port": port,
            "username": username,
            "password": password,
            "use_tls": use_tls,
            "use_ssl": use_ssl,
            "timeout": timeout,
        }
    elif selected == BREVO_BACKEND:
        config["OPTIONS"] = {"api_key": brevo_api_key}
    return {"default": config}


def require_production_from_address(from_email: str) -> None:
    value = (from_email or "").strip().lower()
    if not value or "localhost" in value or value.endswith("@example.com"):
        raise ImproperlyConfigured(
            "Set DEFAULT_FROM_EMAIL to an address on a domain you control before running in production."
        )
