from pathlib import Path

from django.core.exceptions import ValidationError

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
PDF_EXTENSIONS = {".pdf"}
REPORT_EXTENSIONS = PDF_EXTENSIONS | IMAGE_EXTENSIONS
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_PDF_BYTES = 10 * 1024 * 1024
MAX_REPORT_BYTES = MAX_PDF_BYTES


def validate_image_file(upload) -> None:
    _validate_upload(upload, IMAGE_EXTENSIONS, MAX_IMAGE_BYTES, "image")


def validate_pdf_file(upload) -> None:
    _validate_upload(upload, PDF_EXTENSIONS, MAX_PDF_BYTES, "PDF")


def validate_report_file(upload) -> None:
    _validate_upload(upload, REPORT_EXTENSIONS, MAX_REPORT_BYTES, "PDF or image")


def _validate_upload(upload, extensions: set[str], max_bytes: int, label: str) -> None:
    name = getattr(upload, "name", "") or ""
    suffix = Path(name).suffix.lower()
    if suffix not in extensions:
        raise ValidationError(f"Upload a {label} file.")
    size = getattr(upload, "size", 0) or 0
    if size > max_bytes:
        raise ValidationError(f"The {label} file is too large.")
