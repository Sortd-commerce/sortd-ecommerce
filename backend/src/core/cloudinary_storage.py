"""Cloudinary-backed Django storage for public images and private PDFs."""

from __future__ import annotations

import posixpath
from io import BytesIO
from urllib.request import urlopen

import cloudinary
import cloudinary.api
import cloudinary.uploader
import cloudinary.utils
from django.conf import settings
from django.core.files.base import File
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible


class CloudinaryUploadError(Exception):
    """Cloudinary rejected a write. Safe to show to staff."""


def configure_cloudinary() -> None:
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


@deconstructible
class CloudinaryStorage(Storage):
    def __init__(self, resource_type: str = "image", access_mode: str = "upload"):
        self.resource_type = resource_type
        self.access_mode = access_mode
        configure_cloudinary()

    def _public_id(self, name: str) -> str:
        normalized = name.replace("\\", "/").lstrip("/")
        return posixpath.splitext(normalized)[0]

    def _open(self, name, mode="rb"):
        with urlopen(self.url(name), timeout=20) as response:
            return File(BytesIO(response.read()), name)

    def _save(self, name, content):
        if hasattr(content, "seek"):
            content.seek(0)
        public_id = self._public_id(self.generate_filename(name))
        extra: dict = {}
        if self.resource_type == "raw":
            extra["format"] = posixpath.splitext(name)[1].lstrip(".") or "pdf"
        try:
            result = cloudinary.uploader.upload(
                content,
                public_id=public_id,
                resource_type=self.resource_type,
                type=self.access_mode,
                overwrite=True,
                unique_filename=False,
                use_filename=True,
                **extra,
            )
        except Exception as exc:
            raise _upload_error(exc) from exc
        return result.get("public_id") or public_id

    def delete(self, name):
        if not name:
            return
        cloudinary.uploader.destroy(
            self._public_id(name),
            resource_type=self.resource_type,
            type=self.access_mode,
            invalidate=True,
        )

    def exists(self, name):
        try:
            cloudinary.api.resource(
                self._public_id(name),
                resource_type=self.resource_type,
                type=self.access_mode,
            )
        except Exception:
            return False
        return True

    def url(self, name):
        options: dict = {
            "resource_type": self.resource_type,
            "type": self.access_mode,
            "secure": True,
        }
        if self.resource_type == "image" and self.access_mode == "upload":
            options["fetch_format"] = "auto"
            options["quality"] = "auto"
        if self.access_mode == "authenticated":
            options["sign_url"] = True
        built, _ = cloudinary.utils.cloudinary_url(self._public_id(name), **options)
        return built

    def size(self, name):
        info = cloudinary.api.resource(
            self._public_id(name),
            resource_type=self.resource_type,
            type=self.access_mode,
        )
        return int(info.get("bytes") or 0)


def _upload_error(exc: Exception) -> CloudinaryUploadError:
    text = str(exc)
    lowered = text.lower()
    if "missing permissions" in lowered and "create" in lowered:
        return CloudinaryUploadError(
            "Cloudinary refused the upload because this API key cannot create assets. "
            "In Cloudinary open Settings → API Keys, edit this key, and enable the Create (upload) action."
        )
    if "invalid image" in lowered or "invalid file" in lowered:
        return CloudinaryUploadError("Cloudinary rejected that file. Use a JPEG, PNG, or WebP image.")
    return CloudinaryUploadError(f"Cloudinary could not store the file. {text}")
