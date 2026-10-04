from django.contrib.auth import get_user_model

from accounts.tests.helpers import login, signup, signup_and_verify, ApiTestCase
from core.messages import ErrorMessage

User = get_user_model()


class LoginTests(ApiTestCase):
    def test_login_returns_the_profile_and_tokens(self):
        signup_and_verify(self.client)

        response = login(self.client, email="Ada@Example.com")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["message"], "Logged in.")
        self.assertEqual(body["data"]["user"]["email"], "ada@example.com")
        self.assertIn("access", body["data"]["tokens"])
        self.assertIn("refresh", body["data"]["tokens"])

    def test_login_updates_last_login(self):
        signup_and_verify(self.client)
        before = User.objects.get(email="ada@example.com").last_login
        self.assertIsNotNone(before)

        login(self.client)

        after = User.objects.get(email="ada@example.com").last_login
        self.assertIsNotNone(after)
        self.assertGreaterEqual(after, before)

    def test_wrong_password_uses_a_generic_error(self):
        signup_and_verify(self.client)

        response = login(self.client, password="wrong-password")

        self.assertEqual(response.status_code, 401)
        body = response.json()
        self.assertEqual(body["status"], "error")
        self.assertEqual(body["message"], ErrorMessage.INVALID_CREDENTIALS)
        self.assertNotIn("password", response.content.decode().lower())

    def test_wrong_password_on_unverified_account_looks_the_same(self):
        signup(self.client)

        response = login(self.client, password="wrong-password")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["message"], ErrorMessage.INVALID_CREDENTIALS)

    def test_correct_password_on_unverified_account_asks_for_verification(self):
        signup(self.client)

        response = login(self.client)

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["message"], ErrorMessage.EMAIL_NOT_VERIFIED)

    def test_unknown_email_uses_the_same_error_as_a_wrong_password(self):
        wrong_password = login(self.client, email="missing@example.com")
        signup_and_verify(self.client)
        wrong_user = login(self.client, password="wrong-password")

        self.assertEqual(wrong_password.status_code, wrong_user.status_code)
        self.assertEqual(wrong_password.json()["message"], wrong_user.json()["message"])

    def test_inactive_user_cannot_log_in(self):
        signup_and_verify(self.client)
        User.objects.filter(email="ada@example.com").update(is_active=False)

        response = login(self.client)

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["message"], ErrorMessage.INVALID_CREDENTIALS)

    def test_login_requires_a_password(self):
        response = self.client.post(
            "/api/v1/auth/login",
            data={"email": "ada@example.com"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["status"], "error")
