from catalog.stock import StockService
from commerce.cart import CartService
from commerce.delivery import DeliveryService
from commerce.places import build_places_provider
from commerce.orders import OrderService
from accounts.emailing import DjangoEmailSender
from core.clock import SystemClock


def build_delivery_service() -> DeliveryService:
    return DeliveryService(clock=SystemClock(), geocoder=build_places_provider())


def build_cart_service() -> CartService:
    return CartService()


def build_order_service() -> OrderService:
    return OrderService(
        clock=SystemClock(),
        delivery=build_delivery_service(),
        stock=StockService(),
        cart=build_cart_service(),
        email_sender=DjangoEmailSender(),
    )
