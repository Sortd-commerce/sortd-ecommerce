from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from config.environment import LOCAL, PRODUCTION
from config.mailers import CONSOLE_BACKEND, SMTP_BACKEND, build_mailers, require_production_from_address


class MailerConfigTests(SimpleTestCase):
    def test_local_without_host_uses_console(self):
        mailers = build_mailers(environment=LOCAL)

        self.assertEqual(mailers["default"]["BACKEND"], CONSOLE_BACKEND)
        self.assertNotIn("OPTIONS", mailers["default"])

    def test_local_with_host_uses_smtp(self):
        mailers = build_mailers(
            environment=LOCAL,
            host="smtp.resend.com",
            username="resend",
            password="re_test",
        )

        self.assertEqual(mailers["default"]["BACKEND"], SMTP_BACKEND)
        self.assertEqual(mailers["default"]["OPTIONS"]["host"], "smtp.resend.com")
        self.assertTrue(mailers["default"]["OPTIONS"]["use_tls"])

    def test_production_requires_host_and_password(self):
        with self.assertRaisesMessage(ImproperlyConfigured, "EMAIL_HOST is required"):
            build_mailers(environment=PRODUCTION, password="secret")
        with self.assertRaisesMessage(ImproperlyConfigured, "EMAIL_HOST_PASSWORD is required"):
            build_mailers(environment=PRODUCTION, host="smtp.example.com")

    def test_production_rejects_console(self):
        with self.assertRaisesMessage(ImproperlyConfigured, "ESP backend"):
            build_mailers(
                environment=PRODUCTION,
                host="smtp.example.com",
                password="secret",
                backend=CONSOLE_BACKEND,
            )

    def test_brevo_skips_smtp_host(self):
        mailers = build_mailers(
            environment=PRODUCTION,
            backend="anymail.backends.brevo.EmailBackend",
            brevo_api_key="xkeysib-test",
        )

        self.assertEqual(mailers["default"]["BACKEND"], "anymail.backends.brevo.EmailBackend")
        self.assertEqual(mailers["default"]["OPTIONS"]["api_key"], "xkeysib-test")

    def test_brevo_requires_api_key(self):
        with self.assertRaisesMessage(ImproperlyConfigured, "BREVO_API_KEY"):
            build_mailers(environment=LOCAL, backend="anymail.backends.brevo.EmailBackend")

    def test_ssl_and_tls_are_exclusive(self):
        with self.assertRaisesMessage(ImproperlyConfigured, "not both"):
            build_mailers(environment=LOCAL, host="smtp.example.com", use_tls=True, use_ssl=True)

    def test_from_address_rejects_localhost(self):
        with self.assertRaises(ImproperlyConfigured):
            require_production_from_address("Sortd <noreply@localhost>")
        require_production_from_address("Sortd <hello@sortd.example>")
