from django.contrib.auth import get_user_model
from django.core import mail
from django.test import Client

from accounts.tests.helpers import (
    PHONE,
    ApiTestCase,
    make_service_token,
    signup,
    signup_and_verify,
    verification_code_from_mailbox,
    verify_signup,
)
from core.messages import ErrorMessage

User = get_user_model()


class SignupTests(ApiTestCase):
    def test_signup_creates_an_unverified_account_without_tokens(self):
        response = signup(self.client, email="Ada@Example.com")

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["message"], "Check your email for a code.")
        self.assertEqual(body["data"]["email"], "ada@example.com")
        self.assertEqual(body["data"]["first_name"], "Ada")
        self.assertEqual(body["data"]["phone"], PHONE)
        self.assertIsNone(body["data"]["email_verified_at"])
        self.assertNotIn("tokens", body["data"])
        self.assertTrue(User.objects.filter(email="ada@example.com", email_verified_at__isnull=True).exists())
        self.assertEqual(len(mail.outbox), 1)
        self.assertRegex(mail.outbox[0].body, r"\b\d{6}\b")

    def test_signup_strips_surrounding_whitespace_from_names(self):
        response = signup(self.client, full_name="  Ada   Lovelace  ")

        self.assertEqual(response.status_code, 201)
        user = response.json()["data"]
        self.assertEqual(user["first_name"], "Ada")
        self.assertEqual(user["last_name"], "Lovelace")

    def test_unverified_email_can_be_signed_up_again(self):
        signup(self.client, full_name="Ada Lovelace")
        response = signup(self.client, full_name="Augusta Ada")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(User.objects.filter(email="ada@example.com").count(), 1)
        self.assertEqual(User.objects.get(email="ada@example.com").first_name, "Augusta")

    def test_duplicate_verified_email_returns_a_field_error(self):
        signup_and_verify(self.client)

        response = signup(self.client)

        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertEqual(body["status"], "error")
        self.assertEqual(body["errors"][0]["field"], "email")

    def test_invalid_email_is_rejected(self):
        response = signup(self.client, email="not-an-email")

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["errors"][0]["field"], "email")

    def test_missing_full_name_is_rejected(self):
        response = self.client.post(
            "/api/v1/auth/signup",
            data={"email": "ada@example.com", "phone": PHONE},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 422)

    def test_invalid_phone_is_rejected(self):
        response = signup(self.client, phone="0501234567")

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["errors"][0]["field"], "phone")

    def test_signup_accepts_uae_local_style_phone_after_normalization(self):
        response = signup(self.client, phone="+9710501234567")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["data"]["phone"], PHONE)

    def test_signup_phone_too_long_returns_a_clear_message(self):
        response = signup(self.client, phone="+9719715012345678901")

        self.assertEqual(response.status_code, 422)
        body = response.json()
        self.assertEqual(body["errors"][0]["field"], "phone")
        self.assertIn("too long", body["errors"][0]["message"].lower())
        self.assertNotIn("String should have", body["errors"][0]["message"])

    def test_non_dubai_country_code_is_rejected(self):
        response = signup(self.client, phone="+441234567890")

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["errors"][0]["field"], "phone")

    def test_uae_landline_is_rejected(self):
        response = signup(self.client, phone="+97141234567")

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["errors"][0]["field"], "phone")

    def test_verify_signup_code_returns_tokens(self):
        signup(self.client)
        response = verify_signup(self.client)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("access", body["data"]["tokens"])
        self.assertIsNotNone(User.objects.get(email="ada@example.com").email_verified_at)

    def test_signup_code_cannot_be_reused(self):
        signup(self.client)
        code = verification_code_from_mailbox()
        first = verify_signup(self.client, code=code)
        second = verify_signup(self.client, code=code)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 401)
        self.assertIn("code", second.json()["message"].lower())

    def test_wrong_signup_code_reports_tries_left(self):
        signup(self.client)
        response = verify_signup(self.client, code="000000")

        self.assertEqual(response.status_code, 401)
        self.assertIn("left", response.json()["message"].lower())

    def test_signup_requires_a_service_token(self):
        raw = Client()
        response = raw.post(
            "/api/v1/auth/signup",
            data={
                "email": "ada@example.com",
                "full_name": "Ada Lovelace",
                "phone": PHONE,
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 401)

    def test_service_token_signed_with_the_user_key_is_rejected(self):
        from django.conf import settings as dj_settings

        raw = Client()
        response = raw.post(
            "/api/v1/auth/login/code",
            data={"email": "ada@example.com"},
            content_type="application/json",
            HTTP_X_SERVICE_TOKEN=make_service_token(signing_key=dj_settings.JWT_SIGNING_KEY),
        )
        self.assertEqual(response.status_code, 401)

    def test_long_lived_service_token_is_rejected(self):
        raw = Client()
        response = raw.post(
            "/api/v1/auth/login/code",
            data={"email": "ada@example.com"},
            content_type="application/json",
            HTTP_X_SERVICE_TOKEN=make_service_token(lifetime_seconds=600),
        )
        self.assertEqual(response.status_code, 401)
