from unittest.mock import patch

from django.core.files.base import ContentFile
from django.test import SimpleTestCase, override_settings

from config.storages import build_media_storages
from core.cloudinary_storage import CloudinaryStorage, CloudinaryUploadError


class MediaStoragesTests(SimpleTestCase):
    def test_local_uses_filesystem(self):
        storages = build_media_storages(enabled=False)
        self.assertEqual(storages["default"]["BACKEND"], "django.core.files.storage.FileSystemStorage")
        self.assertEqual(storages["private"]["BACKEND"], "django.core.files.storage.FileSystemStorage")

    def test_cloudinary_splits_public_images_and_private_pdfs(self):
        storages = build_media_storages(enabled=True)
        self.assertEqual(storages["default"]["OPTIONS"]["resource_type"], "image")
        self.assertEqual(storages["default"]["OPTIONS"]["access_mode"], "upload")
        self.assertEqual(storages["private"]["OPTIONS"]["resource_type"], "raw")
        self.assertEqual(storages["private"]["OPTIONS"]["access_mode"], "authenticated")


@override_settings(
    CLOUDINARY_CLOUD_NAME="demo",
    CLOUDINARY_API_KEY="key",
    CLOUDINARY_API_SECRET="secret",
)
class CloudinaryStorageTests(SimpleTestCase):
    @patch("core.cloudinary_storage.cloudinary.config")
    @patch("core.cloudinary_storage.cloudinary.utils.cloudinary_url")
    def test_public_image_url_requests_auto_format(self, mock_url, _config):
        mock_url.return_value = ("https://res.cloudinary.com/demo/image/upload/q_auto/products/images/foo", {})
        storage = CloudinaryStorage(resource_type="image", access_mode="upload")
        self.assertEqual(
            storage.url("products/images/foo.jpg"),
            "https://res.cloudinary.com/demo/image/upload/q_auto/products/images/foo",
        )
        kwargs = mock_url.call_args.kwargs
        self.assertEqual(kwargs["resource_type"], "image")
        self.assertEqual(kwargs["quality"], "auto")
        self.assertFalse(kwargs.get("sign_url"))

    @patch("core.cloudinary_storage.cloudinary.config")
    @patch("core.cloudinary_storage.cloudinary.utils.cloudinary_url")
    def test_private_pdf_url_is_signed(self, mock_url, _config):
        mock_url.return_value = ("https://res.cloudinary.com/demo/raw/authenticated/s--x--/products/reports/a", {})
        storage = CloudinaryStorage(resource_type="raw", access_mode="authenticated")
        storage.url("products/reports/a.pdf")
        kwargs = mock_url.call_args.kwargs
        self.assertEqual(kwargs["resource_type"], "raw")
        self.assertTrue(kwargs["sign_url"])

    @patch("core.cloudinary_storage.cloudinary.config")
    @patch("core.cloudinary_storage.cloudinary.uploader.upload")
    def test_save_returns_public_id(self, mock_upload, _config):
        mock_upload.return_value = {"public_id": "products/images/hero"}
        storage = CloudinaryStorage()
        name = storage._save("products/images/hero.jpg", ContentFile(b"\xff\xd8\xff\xd9"))
        self.assertEqual(name, "products/images/hero")
        self.assertEqual(mock_upload.call_args.kwargs["public_id"], "products/images/hero")

    @patch("core.cloudinary_storage.cloudinary.config")
    @patch("core.cloudinary_storage.cloudinary.uploader.upload")
    def test_save_maps_missing_create_permission(self, mock_upload, _config):
        mock_upload.side_effect = Exception(
            '[prodenv:test] Request forbidden due to missing permissions (actions=["create"])'
        )
        storage = CloudinaryStorage()
        with self.assertRaises(CloudinaryUploadError) as raised:
            storage._save("products/images/hero.jpg", ContentFile(b"\xff\xd8\xff\xd9"))
        self.assertIn("cannot create assets", str(raised.exception))
