from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from config.environment import LOCAL, PRODUCTION
from config.mailers import BREVO_BACKEND, CONSOLE_BACKEND, SMTP_BACKEND, build_mailers, require_production_from_address


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

    def test_production_requires_brevo_api_key(self):
        with self.assertRaisesMessage(ImproperlyConfigured, "BREVO_API_KEY is required"):
            build_mailers(environment=PRODUCTION)

    def test_production_forces_brevo_over_smtp(self):
        mailers = build_mailers(
            environment=PRODUCTION,
            host="smtp.example.com",
            password="secret",
            backend=SMTP_BACKEND,
            brevo_api_key="xkeysib-test",
        )

        self.assertEqual(mailers["default"]["BACKEND"], BREVO_BACKEND)

    def test_production_rejects_console_even_with_brevo_key(self):
        mailers = build_mailers(
            environment=PRODUCTION,
            brevo_api_key="xkeysib-test",
            backend=CONSOLE_BACKEND,
        )

        self.assertEqual(mailers["default"]["BACKEND"], BREVO_BACKEND)

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
