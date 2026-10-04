"""Lazy storage getters so FileFields can switch between disk and Cloudinary."""

from django.conf import settings
from django.core.files.storage import FileSystemStorage, Storage
from django.utils.deconstruct import deconstructible


@deconstructible
class SwitchingStorage(Storage):
    """Django caches FileField.storage at import; this wrapper re-reads settings per call."""

    def __init__(self, resource_type: str = "image", access_mode: str = "upload"):
        self.resource_type = resource_type
        self.access_mode = access_mode

    def _inner(self):
        if settings.CLOUDINARY_ENABLED:
            from core.cloudinary_storage import CloudinaryStorage

            return CloudinaryStorage(resource_type=self.resource_type, access_mode=self.access_mode)
        return FileSystemStorage()

    def _open(self, name, mode="rb"):
        return self._inner()._open(name, mode)

    def _save(self, name, content):
        return self._inner()._save(name, content)

    def delete(self, name):
        return self._inner().delete(name)

    def exists(self, name):
        return self._inner().exists(name)

    def listdir(self, path):
        return self._inner().listdir(path)

    def size(self, name):
        return self._inner().size(name)

    def url(self, name):
        from pathlib import Path

        local_path = Path(settings.MEDIA_ROOT) / str(name or "")
        if name and local_path.is_file():
            return FileSystemStorage().url(name)
        return self._inner().url(name)

    def generate_filename(self, filename):
        return self._inner().generate_filename(filename)

    def get_available_name(self, name, max_length=None):
        return self._inner().get_available_name(name, max_length=max_length)


def public_media_storage():
    return SwitchingStorage(resource_type="image", access_mode="upload")


def private_media_storage():
    return SwitchingStorage(resource_type="raw", access_mode="authenticated")
