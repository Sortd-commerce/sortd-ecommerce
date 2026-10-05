"""Ninja Extra API, Swagger docs, auth, and rate limits."""

from ninja_extra import NinjaExtraAPI
from accounts.auth import SessionJWTAuth

from accounts.controllers import AuthController, ProfileController, StaffMeController
from catalog.controllers import CategoryController, ProductController
from commerce.admin_api import AdminController
from commerce.controllers import (
    AddressController,
    CartController,
    DeliveryController,
    OrderController,
    PaymentController,
)
from core.exceptions import register_exception_handlers
from core.throttling import AnonThrottle, UserThrottle

api = NinjaExtraAPI(
    title="Sortd API",
    version="1.0.0",
    description="Sortd storefront and admin API.",
    urls_namespace="api",
    docs_url="/docs",
    openapi_url="/openapi.json",
    auth=SessionJWTAuth(),
    throttle=[AnonThrottle(), UserThrottle()],
)

register_exception_handlers(api)
api.register_controllers(StaffMeController)
api.register_controllers(
    AuthController,
    ProfileController,
    CategoryController,
    ProductController,
    DeliveryController,
    PaymentController,
    AddressController,
    CartController,
    OrderController,
    AdminController,
)
