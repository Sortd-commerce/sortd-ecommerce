from accounts.tests.helpers import NEW_PASSWORD, PASSWORD, ApiTestCase, bearer, login, post_json, signup_and_verify


class ProfileTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        created = signup_and_verify(self.client)
        self.access = created.json()["data"]["tokens"]["access"]
        self.auth = bearer(self.access)

    def test_profile_requires_a_token(self):
        response = self.client.get("/api/v1/profile")

        self.assertEqual(response.status_code, 401)
        body = response.json()
        self.assertEqual(body["status"], "error")
        self.assertEqual(body["code"], "unauthorized")

    def test_profile_rejects_a_malformed_token(self):
        response = self.client.get("/api/v1/profile", **bearer("not-a-token"))

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["status"], "error")

    def test_get_profile_returns_the_signed_in_user(self):
        response = self.client.get("/api/v1/profile", **self.auth)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["message"], "Profile retrieved.")
        self.assertEqual(body["data"]["email"], "ada@example.com")
        self.assertEqual(body["data"]["first_name"], "Ada")
        self.assertEqual(body["data"]["last_name"], "Lovelace")
        self.assertEqual(body["data"]["phone"], "+971501234567")

    def test_patch_updates_only_the_provided_name(self):
        response = self.client.patch(
            "/api/v1/profile",
            data={"first_name": "Augusta"},
            content_type="application/json",
            **self.auth,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["first_name"], "Augusta")
        self.assertEqual(data["last_name"], "Lovelace")

    def test_patch_can_clear_a_name(self):
        response = self.client.patch(
            "/api/v1/profile",
            data={"last_name": "   "},
            content_type="application/json",
            **self.auth,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["last_name"], "")

    def test_password_change_rejects_the_current_password_when_it_is_wrong(self):
        response = post_json(
            self.client,
            "/api/v1/profile/password",
            {"current_password": "wrong-password", "new_password": NEW_PASSWORD},
            **self.auth,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["errors"][0]["field"], "current_password")

    def test_password_change_rejects_a_weak_new_password(self):
        response = post_json(
            self.client,
            "/api/v1/profile/password",
            {"current_password": PASSWORD, "new_password": "password123"},
            **self.auth,
        )

        self.assertIn(response.status_code, {400, 422})
        self.assertEqual(response.json()["status"], "error")

    def test_password_change_lets_the_new_password_log_in(self):
        changed = post_json(
            self.client,
            "/api/v1/profile/password",
            {"current_password": PASSWORD, "new_password": NEW_PASSWORD},
            **self.auth,
        )
        self.assertEqual(changed.status_code, 200)
        self.assertTrue(changed.json()["data"]["password_changed"])

        old_login = login(self.client, password=PASSWORD)
        new_login = login(self.client, password=NEW_PASSWORD)

        self.assertEqual(old_login.status_code, 401)
        self.assertEqual(new_login.status_code, 200)

    def test_profile_update_requires_authentication(self):
        response = self.client.patch(
            "/api/v1/profile",
            data={"first_name": "Augusta"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["status"], "error")
