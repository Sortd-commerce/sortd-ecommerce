import jwt
from django.conf import settings
from django.test import override_settings

from accounts.tests.helpers import ApiTestCase, post_json, signup_and_verify


class TokenTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        created = signup_and_verify(self.client)
        tokens = created.json()["data"]["tokens"]
        self.access = tokens["access"]
        self.refresh = tokens["refresh"]

    def test_refresh_rotates_the_refresh_token(self):
        response = post_json(self.client, "/api/v1/auth/refresh", {"refresh": self.refresh})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "success")
        self.assertNotEqual(body["data"]["refresh"], self.refresh)
        self.assertTrue(body["data"]["access"])

    def test_used_refresh_token_cannot_be_reused(self):
        rotated = post_json(self.client, "/api/v1/auth/refresh", {"refresh": self.refresh})
        self.assertEqual(rotated.status_code, 200)

        reused = post_json(self.client, "/api/v1/auth/refresh", {"refresh": self.refresh})

        self.assertEqual(reused.status_code, 401)
        self.assertEqual(reused.json()["status"], "error")

    def test_verify_accepts_an_access_token(self):
        response = post_json(self.client, "/api/v1/auth/verify", {"token": self.access})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["data"]["valid"])

    def test_verify_rejects_a_garbage_token(self):
        response = post_json(self.client, "/api/v1/auth/verify", {"token": "not-a-token"})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["status"], "error")

    def test_logout_revokes_the_refresh_token(self):
        logged_out = post_json(self.client, "/api/v1/auth/logout", {"refresh": self.refresh})
        self.assertEqual(logged_out.status_code, 200)
        self.assertTrue(logged_out.json()["data"]["logged_out"])

        refreshed = post_json(self.client, "/api/v1/auth/refresh", {"refresh": self.refresh})
        self.assertEqual(refreshed.status_code, 401)

    def test_logout_rejects_an_invalid_refresh_token(self):
        response = post_json(self.client, "/api/v1/auth/logout", {"refresh": "not-a-token"})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["status"], "error")


class StorefrontAccessTests(ApiTestCase):
    @override_settings(STOREFRONT_ACCESS_PASSWORD="shared-secret")
    def test_site_access_issues_a_scoped_token_for_the_correct_password(self):
        response = post_json(
            self.client, "/api/v1/auth/site-access", {"password": "shared-secret"}
        )

        self.assertEqual(response.status_code, 200)
        token = response.json()["data"]["token"]
        claims = jwt.decode(
            token,
            settings.SERVICE_SIGNING_KEY,
            algorithms=["HS256"],
            audience="sortd-storefront",
            issuer="sortd-api",
        )
        self.assertEqual(claims["token_use"], "site_access")

    @override_settings(STOREFRONT_ACCESS_PASSWORD="shared-secret")
    def test_site_access_rejects_an_incorrect_password(self):
        response = post_json(
            self.client, "/api/v1/auth/site-access", {"password": "wrong"}
        )

        self.assertEqual(response.status_code, 401)

    @override_settings(STOREFRONT_ACCESS_PASSWORD="")
    def test_site_access_fails_closed_when_no_password_is_configured(self):
        response = post_json(
            self.client, "/api/v1/auth/site-access", {"password": "anything"}
        )

        self.assertEqual(response.status_code, 503)
