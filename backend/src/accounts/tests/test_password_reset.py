from django.contrib.auth import get_user_model
from django.core import mail

from accounts.tests.helpers import NEW_PASSWORD, PASSWORD, ApiTestCase, login, post_json, signup, signup_and_verify, verification_token_from_mailbox
from core.messages import ErrorMessage

User = get_user_model()


class PasswordResetTests(ApiTestCase):
    def test_unknown_email_looks_the_same_and_sends_nothing(self):
        response = post_json(self.client, "/api/v1/auth/forgot-password", {"email": "missing@example.com"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    def test_unverified_account_does_not_get_a_reset_mail(self):
        signup(self.client)
        mail.outbox.clear()
        response = post_json(self.client, "/api/v1/auth/forgot-password", {"email": "ada@example.com"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    def test_reset_link_updates_the_password(self):
        signup_and_verify(self.client)
        mail.outbox.clear()
        asked = post_json(self.client, "/api/v1/auth/forgot-password", {"email": "Ada@Example.com"})
        self.assertEqual(asked.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("reset-password?token=", mail.outbox[0].body)
        token = verification_token_from_mailbox()
        reset = post_json(
            self.client,
            "/api/v1/auth/reset-password",
            {"token": token, "password": NEW_PASSWORD},
        )
        self.assertEqual(reset.status_code, 200)
        old = login(self.client, password=PASSWORD)
        self.assertEqual(old.status_code, 401)
        fresh = login(self.client, password=NEW_PASSWORD)
        self.assertEqual(fresh.status_code, 200)

    def test_used_reset_token_cannot_be_replayed(self):
        signup_and_verify(self.client)
        mail.outbox.clear()
        post_json(self.client, "/api/v1/auth/forgot-password", {"email": "ada@example.com"})
        token = verification_token_from_mailbox()
        post_json(self.client, "/api/v1/auth/reset-password", {"token": token, "password": NEW_PASSWORD})
        again = post_json(
            self.client,
            "/api/v1/auth/reset-password",
            {"token": token, "password": "An0ther-pass-77"},
        )
        self.assertEqual(again.status_code, 400)
        self.assertEqual(again.json()["message"], ErrorMessage.INVALID_VERIFICATION)
