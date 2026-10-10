from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from openpyxl import Workbook
from PIL import Image

from catalog.excel_image_importer import ProductImageSheetError, process_product_image_sheet
from catalog.models import ProductImage
from catalog.tests.test_catalog import make_product


def image_sheet(rows):
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["product_id", "image_url", "alt"])
    for row in rows:
        sheet.append(row)
    buffer = BytesIO()
    workbook.save(buffer)
    return SimpleUploadedFile("image-batch.xlsx", buffer.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


class ProductImageSheetImporterTests(TestCase):
    def test_rejects_more_than_ten_image_rows_before_upload(self):
        upload = image_sheet([[1, f"https://images.example/{index}.jpg", ""] for index in range(11)])
        with self.assertRaisesMessage(ProductImageSheetError, "no more than 10"):
            process_product_image_sheet(upload)

    def test_requires_product_id_and_image_url_columns(self):
        workbook = Workbook()
        workbook.active.append(["sku", "url"])
        workbook.active.append(["SKU-1", "https://images.example/image.jpg"])
        buffer = BytesIO()
        workbook.save(buffer)
        upload = SimpleUploadedFile("image-batch.xlsx", buffer.getvalue())
        with self.assertRaisesMessage(ProductImageSheetError, "product_id and image_url"):
            process_product_image_sheet(upload)

    def test_missing_product_is_reported_in_row_result(self):
        upload = image_sheet([[999999, "https://images.example/product.jpg", "Product image"]])
        result = process_product_image_sheet(upload)
        self.assertEqual(result["row_count"], 1)
        self.assertEqual(result["uploaded"], 0)
        self.assertEqual(result["results"][0]["status"], "error")
        self.assertIn("was not found", result["results"][0]["error"])

    def test_upload_appends_image_and_returns_stored_url(self):
        product, _variant = make_product()
        upload = image_sheet([[product.id, "https://images.example/product.jpg", "Product photo"]])
        image_buffer = BytesIO()
        Image.new("RGB", (2, 2), color="red").save(image_buffer, format="JPEG")
        image_bytes = image_buffer.getvalue()
        with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            with patch(
                "catalog.excel_image_importer._download_public_image",
                return_value=(ContentFile(image_bytes, name="product.jpg"), "product.jpg", len(image_bytes)),
            ):
                result = process_product_image_sheet(upload)

        self.assertEqual(result["uploaded"], 1)
        image = ProductImage.objects.get(product=product)
        self.assertEqual(image.alt, "Product photo")
        self.assertEqual(image.role, "primary")
        self.assertTrue(result["results"][0]["cloudinary_url"])

    @patch("catalog.excel_image_importer.socket.getaddrinfo")
    def test_rejects_private_ip_hosts(self, getaddrinfo):
        from catalog.excel_image_importer import _public_https_url

        getaddrinfo.return_value = [(None, None, None, None, ("127.0.0.1", 443))]
        with self.assertRaisesMessage(ValueError, "public internet address"):
            _public_https_url("https://images.example/image.jpg")
