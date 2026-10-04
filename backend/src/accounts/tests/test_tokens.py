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
