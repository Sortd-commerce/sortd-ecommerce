from django.contrib.auth import get_user_model
from django.core import mail

from accounts.tests.helpers import (
    PASSWORD,
    login,
    login_with_code,
    request_login_code,
    signup,
    signup_and_verify,
    verify_login,
    ApiTestCase,
)
from core.messages import ErrorMessage

User = get_user_model()


class LoginTests(ApiTestCase):
    def test_login_code_returns_the_profile_and_tokens(self):
        signup_and_verify(self.client)

        response = login_with_code(self.client, email="Ada@Example.com")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["message"], "Logged in.")
        self.assertEqual(body["data"]["user"]["email"], "ada@example.com")
        self.assertIn("access", body["data"]["tokens"])
        self.assertIn("refresh", body["data"]["tokens"])

    def test_login_code_updates_last_login(self):
        signup_and_verify(self.client)
        before = User.objects.get(email="ada@example.com").last_login
        self.assertIsNotNone(before)

        login_with_code(self.client)

        after = User.objects.get(email="ada@example.com").last_login
        self.assertIsNotNone(after)
        self.assertGreaterEqual(after, before)

    def test_wrong_login_code_reports_tries_left(self):
        signup_and_verify(self.client)
        request_login_code(self.client)

        response = verify_login(self.client, code="000000")

        self.assertEqual(response.status_code, 401)
        self.assertIn("left", response.json()["message"].lower())

    def test_password_login_fails_for_passwordless_users(self):
        signup_and_verify(self.client)

        response = login(self.client, password="wrong-password")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["message"], ErrorMessage.INVALID_CREDENTIALS)

    def test_staff_password_login_still_works(self):
        user = User.objects.create_user(
            email="staff@example.com",
            password=PASSWORD,
            first_name="Staff",
            last_name="User",
        )
        user.email_verified_at = user.date_joined
        user.save(update_fields=["email_verified_at"])

        response = login(self.client, email="staff@example.com")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["user"]["email"], "staff@example.com")

    def test_login_code_for_unverified_account_sends_signup_verification(self):
        signup(self.client)

        response = request_login_code(self.client)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["purpose"], "signup")
        self.assertEqual(len(mail.outbox), 2)
        self.assertIn("verification", mail.outbox[-1].subject.lower())

    def test_login_code_unknown_email_is_clear(self):
        response = request_login_code(self.client, email="missing@example.com")

        self.assertIn(response.status_code, {400, 422})
        body = response.json()
        self.assertEqual(body["status"], "error")
        self.assertIn("No account found", body["message"])

    def test_inactive_user_cannot_log_in_with_code(self):
        signup_and_verify(self.client)
        User.objects.filter(email="ada@example.com").update(is_active=False)

        response = login_with_code(self.client)

        self.assertEqual(response.status_code, 401)

    def test_password_login_requires_a_password(self):
        response = self.client.post(
            "/api/v1/auth/login",
            data={"email": "ada@example.com"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["status"], "error")
