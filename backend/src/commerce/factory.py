from catalog.stock import StockService
from commerce.cart import CartService
from commerce.delivery import DeliveryService
from commerce.geocoding import build_geocoder
from commerce.orders import OrderService
from core.clock import SystemClock


def build_delivery_service() -> DeliveryService:
    return DeliveryService(clock=SystemClock(), geocoder=build_geocoder())


def build_cart_service() -> CartService:
    return CartService()


def build_order_service() -> OrderService:
    return OrderService(
        clock=SystemClock(),
        delivery=build_delivery_service(),
        stock=StockService(),
        cart=build_cart_service(),
    )
