from django.contrib.auth import get_user_model
from django.core import mail
from django.test import Client

from accounts.tests.helpers import PASSWORD, PHONE, ApiTestCase, login, make_service_token, signup, signup_and_verify, verification_token_from_mailbox, verify_email
from core.messages import ErrorMessage

User = get_user_model()


class SignupTests(ApiTestCase):
    def test_signup_creates_an_unverified_account_without_tokens(self):
        response = signup(self.client, email="Ada@Example.com")

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["message"], "Account created.")
        self.assertEqual(body["data"]["email"], "ada@example.com")
        self.assertEqual(body["data"]["first_name"], "Ada")
        self.assertEqual(body["data"]["phone"], PHONE)
        self.assertIsNone(body["data"]["email_verified_at"])
        self.assertNotIn("tokens", body["data"])
        self.assertTrue(User.objects.filter(email="ada@example.com", email_verified_at__isnull=True).exists())
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("token=", mail.outbox[0].body)
        html = mail.outbox[0].alternatives[0][0]
        self.assertIn("token=", html)
        self.assertEqual(mail.outbox[0].alternatives[0][1], "text/html")
        serialized = mail.outbox[0].message().as_string()
        self.assertNotIn("token=3D", serialized)
        self.assertIn("token=", mail.outbox[0].body)

    def test_quoted_printable_token_still_verifies(self):
        signup(self.client)
        token = verification_token_from_mailbox()
        mangled = (
            f"http://localhost:3000/verify-email?token=3D{token[:20]}=\n{token[20:]}"
        )
        response = verify_email(self.client, mangled)

        self.assertEqual(response.status_code, 200)

    def test_signup_strips_surrounding_whitespace_from_names(self):
        response = signup(self.client, first_name="  Ada  ", last_name="  Lovelace  ")

        self.assertEqual(response.status_code, 201)
        user = response.json()["data"]
        self.assertEqual(user["first_name"], "Ada")
        self.assertEqual(user["last_name"], "Lovelace")

    def test_unverified_email_can_be_signed_up_again(self):
        signup(self.client, first_name="Ada")
        response = signup(self.client, first_name="Augusta")

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

    def test_short_password_is_rejected(self):
        response = signup(self.client, password="short")

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["errors"][0]["field"], "password")
        self.assertFalse(User.objects.exists())

    def test_common_password_is_rejected(self):
        response = signup(self.client, password="password123")

        self.assertIn(response.status_code, {400, 422})
        self.assertFalse(User.objects.exists())

    def test_missing_password_is_rejected(self):
        response = self.client.post(
            "/api/v1/auth/signup",
            data={"email": "ada@example.com", "first_name": "Ada", "last_name": "Lovelace", "phone": PHONE},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 422)

    def test_invalid_phone_is_rejected(self):
        response = signup(self.client, phone="0501234567")

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["errors"][0]["field"], "phone")

    def test_verify_email_returns_tokens(self):
        signup(self.client)
        response = verify_email(self.client)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("access", body["data"]["tokens"])
        self.assertIsNotNone(User.objects.get(email="ada@example.com").email_verified_at)

    def test_magic_link_cannot_be_reused(self):
        signup(self.client)
        token = verification_token_from_mailbox()
        first = verify_email(self.client, token)
        second = verify_email(self.client, token)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 401)
        self.assertEqual(second.json()["message"], ErrorMessage.INVALID_VERIFICATION)

    def test_get_does_not_verify_email(self):
        signup(self.client)
        token = verification_token_from_mailbox()

        response = self.client.get(f"/api/v1/auth/verify-email?token={token}")

        self.assertEqual(response.status_code, 405)
        self.assertIsNone(User.objects.get(email="ada@example.com").email_verified_at)

    def test_password_is_not_returned(self):
        response = signup(self.client)

        self.assertNotIn(PASSWORD, response.content.decode())

    def test_signup_requires_a_service_token(self):
        raw = Client()
        response = raw.post(
            "/api/v1/auth/signup",
            data={
                "email": "ada@example.com",
                "password": PASSWORD,
                "first_name": "Ada",
                "last_name": "Lovelace",
                "phone": PHONE,
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 401)

    def test_service_token_signed_with_the_user_key_is_rejected(self):
        from django.conf import settings as dj_settings

        raw = Client()
        response = raw.post(
            "/api/v1/auth/login",
            data={"email": "ada@example.com", "password": PASSWORD},
            content_type="application/json",
            HTTP_X_SERVICE_TOKEN=make_service_token(signing_key=dj_settings.JWT_SIGNING_KEY),
        )
        self.assertEqual(response.status_code, 401)

    def test_long_lived_service_token_is_rejected(self):
        raw = Client()
        response = raw.post(
            "/api/v1/auth/login",
            data={"email": "ada@example.com", "password": PASSWORD},
            content_type="application/json",
            HTTP_X_SERVICE_TOKEN=make_service_token(lifetime_seconds=600),
        )
        self.assertEqual(response.status_code, 401)
