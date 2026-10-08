"""Download remote product images (including public Google Drive links)."""

from __future__ import annotations

import mimetypes
import re
from io import BytesIO
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

from django.core.files.base import ContentFile

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
PDF_EXTENSIONS = {".pdf"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_PDF_BYTES = 10 * 1024 * 1024
USER_AGENT = "SortdCatalogImporter/1.0"

_DRIVE_FILE_RE = re.compile(r"/file/d/([a-zA-Z0-9_-]+)")
_DRIVE_ID_RE = re.compile(r"[?&]id=([a-zA-Z0-9_-]+)")


class ImageFetchError(ValueError):
    pass


def normalize_image_url(raw: str) -> str:
    value = str(raw or "").strip()
    if not value:
        raise ImageFetchError("Image URL is empty.")
    if value.startswith("http://") or value.startswith("https://"):
        parsed = urlparse(value)
        host = parsed.netloc.lower()
        if "drive.google.com" in host or "docs.google.com" in host:
            file_id = _drive_file_id(value)
            if not file_id:
                raise ImageFetchError(f"Could not read a Google Drive file id from '{value}'.")
            return f"https://drive.google.com/uc?export=download&id={file_id}"
        return value
    raise ImageFetchError(f"Unsupported image reference '{value}'. Use a public https URL.")


def is_remote_ref(raw: str) -> bool:
    value = str(raw or "").strip()
    return value.startswith("http://") or value.startswith("https://")


def resolve_local_path(raw: str, base_dir: Path | None) -> Path | None:
    value = str(raw or "").strip()
    if not value or is_remote_ref(value):
        return None
    path = Path(value)
    if path.is_file():
        return path.resolve()
    if base_dir is not None:
        candidate = (base_dir / value).resolve()
        if candidate.is_file():
            return candidate
    return None


def is_media_ref(raw: str, *, base_dir: Path | None = None) -> bool:
    value = str(raw or "").strip()
    if not value:
        return False
    if is_remote_ref(value):
        return True
    return resolve_local_path(value, base_dir) is not None


def load_image(raw: str, *, base_dir: Path | None = None) -> tuple[ContentFile, str, int]:
    local = resolve_local_path(raw, base_dir)
    if local is not None:
        payload = local.read_bytes()
        if len(payload) > MAX_IMAGE_BYTES:
            raise ImageFetchError("Image is larger than 5 MB.")
        suffix = local.suffix.lower()
        if suffix not in IMAGE_EXTENSIONS:
            raise ImageFetchError(f"Unsupported image type '{suffix or 'unknown'}'.")
        return ContentFile(payload, name=local.name), local.name, len(payload)
    return fetch_image(raw)


REPORT_EXTENSIONS = PDF_EXTENSIONS | IMAGE_EXTENSIONS
MAX_REPORT_BYTES = MAX_PDF_BYTES


def load_report(raw: str, *, base_dir: Path | None = None) -> tuple[ContentFile, str, int]:
    local = resolve_local_path(raw, base_dir)
    if local is not None:
        payload = local.read_bytes()
        if len(payload) > MAX_REPORT_BYTES:
            raise ImageFetchError("Lab report file is larger than 10 MB.")
        suffix = local.suffix.lower()
        if suffix not in REPORT_EXTENSIONS:
            raise ImageFetchError("Upload a PDF or image file for the lab report.")
        return ContentFile(payload, name=local.name), local.name, len(payload)
    suffix = Path(urlparse(normalize_document_url(raw)).path).suffix.lower()
    if suffix in IMAGE_EXTENSIONS:
        return fetch_image(raw)
    return fetch_pdf(raw)


def load_pdf(raw: str, *, base_dir: Path | None = None) -> tuple[ContentFile, str, int]:
    local = resolve_local_path(raw, base_dir)
    if local is not None:
        payload = local.read_bytes()
        if len(payload) > MAX_PDF_BYTES:
            raise ImageFetchError("PDF is larger than 10 MB.")
        if local.suffix.lower() not in PDF_EXTENSIONS:
            raise ImageFetchError("Upload a PDF file.")
        return ContentFile(payload, name=local.name), local.name, len(payload)
    return fetch_pdf(raw)


def split_image_urls(raw: str) -> list[str]:
    if not raw or not str(raw).strip():
        return []
    parts = re.split(r"[\n,;]+", str(raw))
    return [part.strip() for part in parts if part.strip()]


def normalize_document_url(raw: str) -> str:
    return normalize_image_url(raw)


def fetch_pdf(raw_url: str) -> tuple[ContentFile, str, int]:
    url = normalize_document_url(raw_url)
    request = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(request, timeout=30) as response:
            payload = response.read(MAX_PDF_BYTES + 1)
            if len(payload) > MAX_PDF_BYTES:
                raise ImageFetchError("PDF is larger than 10 MB.")
            content_type = (response.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
    except ImageFetchError:
        raise
    except Exception as exc:
        raise ImageFetchError(f"Could not download '{raw_url}': {exc}") from exc

    filename = _filename_from_response(url, content_type, default_ext=".pdf", allowed=PDF_EXTENSIONS)
    return ContentFile(payload, name=filename), filename, len(payload)


def fetch_image(raw_url: str) -> tuple[ContentFile, str, int]:
    url = normalize_image_url(raw_url)
    request = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(request, timeout=30) as response:
            payload = response.read(MAX_IMAGE_BYTES + 1)
            if len(payload) > MAX_IMAGE_BYTES:
                raise ImageFetchError("Image is larger than 5 MB.")
            content_type = (response.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
    except ImageFetchError:
        raise
    except Exception as exc:
        raise ImageFetchError(f"Could not download '{raw_url}': {exc}") from exc

    filename = _filename_from_response(url, content_type, default_ext=".jpg", allowed=IMAGE_EXTENSIONS)
    suffix = Path(filename).suffix.lower()
    if suffix not in IMAGE_EXTENSIONS:
        raise ImageFetchError(f"Downloaded file is not a supported image type ({suffix or 'unknown'}).")
    return ContentFile(payload, name=filename), filename, len(payload)


def _drive_file_id(url: str) -> str | None:
    match = _DRIVE_FILE_RE.search(url)
    if match:
        return match.group(1)
    query = parse_qs(urlparse(url).query)
    values = query.get("id") or []
    return values[0] if values else None


def _filename_from_response(
    url: str,
    content_type: str,
    *,
    default_ext: str,
    allowed: set[str],
) -> str:
    ext = mimetypes.guess_extension(content_type or "") or ""
    if ext == ".jpe":
        ext = ".jpg"
    if ext not in allowed:
        lowered = url.lower()
        for candidate in allowed:
            if candidate in lowered:
                ext = candidate
                break
        else:
            ext = default_ext
    stem = Path(urlparse(url).path).stem or "download"
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "-", stem).strip("-") or "download"
    return f"{safe[:80]}{ext}"
