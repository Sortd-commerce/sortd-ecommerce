from accounts.tests.helpers import ApiTestCase


class ApiDocumentationTests(ApiTestCase):
    def test_openapi_lists_auth_and_profile_routes(self):
        response = self.client.get("/api/v1/openapi.json")

        self.assertEqual(response.status_code, 200)
        paths = response.json()["paths"]
        self.assertIn("/api/v1/auth/signup", paths)
        self.assertIn("/api/v1/auth/login", paths)
        self.assertIn("/api/v1/auth/refresh", paths)
        self.assertIn("/api/v1/auth/verify", paths)
        self.assertIn("/api/v1/auth/verify-email", paths)
        self.assertIn("/api/v1/auth/resend-verification", paths)
        self.assertIn("/api/v1/products", paths)
        self.assertIn("/api/v1/profile", paths)
        self.assertIn("/api/v1/profile/password", paths)

    def test_swagger_ui_is_available(self):
        response = self.client.get("/api/v1/docs")

        self.assertEqual(response.status_code, 200)
        self.assertIn("swagger", response.content.decode().lower())
