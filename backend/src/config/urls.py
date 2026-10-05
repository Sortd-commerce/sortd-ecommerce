from django.conf import settings
from django.conf.urls.static import static
from django.urls import path

from core.api import api
from core.http import healthz, staff_me

urlpatterns = [
    path("", healthz),
    path("healthz", healthz),
    path("api/v1/admin/me", staff_me),
    path("api/v1/staff/me", staff_me),
    path("api/v1/", api.urls),
]

handler404 = "core.http.api_or_html_404"

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
