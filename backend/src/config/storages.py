"""Storage backend map for public images vs private PDFs."""


def build_media_storages(*, enabled: bool) -> dict:
    staticfiles = {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"}
    if not enabled:
        filesystem = {"BACKEND": "django.core.files.storage.FileSystemStorage"}
        return {"default": filesystem, "private": filesystem, "staticfiles": staticfiles}
    return {
        "default": {
            "BACKEND": "core.cloudinary_storage.CloudinaryStorage",
            "OPTIONS": {"resource_type": "image", "access_mode": "upload"},
        },
        "private": {
            "BACKEND": "core.cloudinary_storage.CloudinaryStorage",
            "OPTIONS": {"resource_type": "raw", "access_mode": "authenticated"},
        },
        "staticfiles": staticfiles,
    }
