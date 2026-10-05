from ninja import Query
from ninja_extra import ControllerBase, api_controller, route, status
from ninja_extra.exceptions import NotFound, ValidationError
from ninja_extra.permissions import AllowAny, IsAuthenticated
from accounts.auth import SessionJWTAuth

from commerce.cart import CartLineCommand
from commerce.factory import build_cart_service, build_delivery_service, build_order_service
from commerce.models import Address, PaymentMethod, normalize_postal_code
from commerce.orders import PlaceOrderCommand, request_hash_for, serialize_order
from commerce.pricing import quote_variants, serialize_offer_rules
from commerce.schemas import (
    AddressIn,
    AutocompleteIn,
    CartItemIn,
    CartMergeIn,
    CartSyncIn,
    DeliveryCheckIn,
    PlaceOrderIn,
    PriceQuoteIn,
)
from core.messages import ErrorMessage
from core.pagination import PageQuery, paginate_queryset
from core.responses import ErrorResponse, SuccessResponse, success
from core.throttling import PlacesThrottle

_ERROR_RESPONSES = {
    400: ErrorResponse,
    401: ErrorResponse,
    404: ErrorResponse,
    409: ErrorResponse,
    422: ErrorResponse,
}


def _component_value(components: list[dict], type_name: str) -> str:
    for component in components:
        if type_name in (component.get("types") or []):
            value = component.get("long_name") or component.get("short_name") or ""
            if value:
                return str(value)
    return ""


@api_controller("/delivery", tags=["Delivery"], auth=None, permissions=[AllowAny], use_unique_op_id=False)
class DeliveryController(ControllerBase):
    @route.post(
        "/autocomplete",
        response={200: SuccessResponse, **_ERROR_RESPONSES},
        summary="Autocomplete address suggestions",
        throttle=[PlacesThrottle()],
    )
    def autocomplete(self, payload: AutocompleteIn):
        data = build_delivery_service().autocomplete(
            query=payload.q, country=payload.country, limit=payload.limit
        )
        return success("Address suggestions retrieved.", data)

    @route.post("/check", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Check if an address is serviceable")
    def check(self, payload: DeliveryCheckIn):
        data = build_delivery_service().check_address(
            address=payload.address,
            place_id=payload.place_id,
            latitude=payload.latitude,
            longitude=payload.longitude,
        )
        return success("Delivery check completed.", data)

    @route.get("/windows", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="List upcoming delivery windows")
    def windows(self):
        slots = build_delivery_service().list_windows()
        data = [
            {
                "date": slot.date.isoformat(),
                "start_time": slot.start_time.isoformat(),
                "end_time": slot.end_time.isoformat(),
                "capacity": slot.capacity,
                "remaining": slot.remaining,
                "window_id": slot.window_id,
                "source": slot.source,
            }
            for slot in slots
        ]
        return success("Delivery windows retrieved.", data)


@api_controller("/pricing", tags=["Pricing"], auth=None, permissions=[AllowAny], use_unique_op_id=False)
class PricingController(ControllerBase):
    @route.get("", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Delivery and discount rules")
    def rules(self):
        return success("Pricing retrieved.", serialize_offer_rules())

    @route.post("/quote", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Quote a basket")
    def quote(self, payload: PriceQuoteIn):
        quoted = quote_variants(
            [(item.variant_id, item.quantity) for item in payload.items],
            code=payload.discount_code,
        )
        return success("Quote ready.", quoted.as_dict())


@api_controller("/payments", tags=["Payments"], auth=None, permissions=[AllowAny], use_unique_op_id=False)
class PaymentController(ControllerBase):
    @route.get("/methods", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="List payment methods")
    def methods(self):
        rows = [
            {"code": method.code, "name": method.name, "is_active": method.is_active}
            for method in PaymentMethod.objects.order_by("-is_active", "name")
        ]
        return success("Payment methods retrieved.", rows)


@api_controller("/addresses", tags=["Addresses"], auth=SessionJWTAuth(), permissions=[IsAuthenticated], use_unique_op_id=False)
class AddressController(ControllerBase):
    @route.get("", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="List saved addresses")
    def list_addresses(self):
        rows = [
            _address_payload(row) for row in Address.objects.filter(user=self.context.request.user)
        ]
        return success("Addresses retrieved.", rows)

    @route.post("", response={201: SuccessResponse, **_ERROR_RESPONSES}, summary="Save an address")
    def create(self, payload: AddressIn):
        address = _save_address(user=self.context.request.user, payload=payload)
        return status.HTTP_201_CREATED, success("Address saved.", _address_payload(address))

    @route.patch("/{address_id}", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Update a saved address")
    def update(self, address_id: int, payload: AddressIn):
        instance = Address.objects.filter(user=self.context.request.user, pk=address_id).first()
        if instance is None:
            raise NotFound(ErrorMessage.NOT_FOUND)
        address = _save_address(user=self.context.request.user, payload=payload, instance=instance)
        return success("Address updated.", _address_payload(address))


@api_controller("/cart", tags=["Cart"], auth=SessionJWTAuth(), permissions=[IsAuthenticated], use_unique_op_id=False)
class CartController(ControllerBase):
    @route.get("", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Get the cart")
    def retrieve(self):
        return success("Cart retrieved.", build_cart_service().view(self.context.request.user))

    @route.post("/items", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Add or merge cart items")
    def merge(self, payload: CartMergeIn):
        lines = [CartLineCommand(variant_id=item.variant_id, quantity=item.quantity) for item in payload.items if item.quantity]
        data = build_cart_service().merge(self.context.request.user, lines)
        return success("Cart updated.", data)

    @route.put("/sync", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Replace the cart with client lines")
    def sync(self, payload: CartSyncIn):
        lines = [CartLineCommand(variant_id=item.variant_id, quantity=item.quantity) for item in payload.items]
        data = build_cart_service().replace(self.context.request.user, lines)
        return success("Cart synced.", data)

    @route.put("/items/{item_id}", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Set a cart line quantity")
    def set_quantity(self, item_id: int, payload: CartItemIn):
        from commerce.models import CartItem
        from ninja_extra.exceptions import NotFound
        from core.messages import ErrorMessage

        item = CartItem.objects.filter(id=item_id, cart__user=self.context.request.user).first()
        if item is None:
            raise NotFound(ErrorMessage.NOT_FOUND)
        data = build_cart_service().set_item(
            self.context.request.user, variant_id=item.variant_id, quantity=payload.quantity
        )
        return success("Cart updated.", data)

    @route.delete("/items/{item_id}", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Remove a cart line")
    def remove(self, item_id: int):
        data = build_cart_service().remove_item(self.context.request.user, item_id=item_id)
        return success("Cart updated.", data)


@api_controller("/orders", tags=["Orders"], auth=SessionJWTAuth(), permissions=[IsAuthenticated], use_unique_op_id=False)
class OrderController(ControllerBase):
    @route.get("", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="List orders")
    def list_orders(self, query: Query[PageQuery]):
        page = paginate_queryset(
            build_order_service().list_for(self.context.request.user),
            page=query.page,
            page_size=query.page_size,
        )
        page["results"] = [serialize_order(order) for order in page["results"]]
        return success("Orders retrieved.", page)

    @route.post("", response={201: SuccessResponse, **_ERROR_RESPONSES}, summary="Place an order")
    def create(self, payload: PlaceOrderIn):
        key = (self.context.request.headers.get("Idempotency-Key") or "").strip()
        body = payload.dict()
        order = build_order_service().place(
            self.context.request.user,
            PlaceOrderCommand(
                address_id=payload.address_id,
                delivery_date=payload.delivery_date,
                window_id=payload.window_id,
                window_source=payload.window_source,
                note=payload.note,
                expected_total=payload.expected_total,
                discount_code=payload.discount_code,
                payment_method=payload.payment_method,
            ),
            idempotency_key=key,
            request_hash=request_hash_for(body),
        )
        return status.HTTP_201_CREATED, success("Order placed.", serialize_order(order))

    @route.get("/{number}", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Get an order")
    def retrieve(self, number: str):
        order = build_order_service().get_for(self.context.request.user, number=number)
        return success("Order retrieved.", serialize_order(order))

    @route.post("/{number}/cancel", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Cancel an order")
    def cancel(self, number: str):
        order = build_order_service().cancel(self.context.request.user, number=number)
        return success("Order cancelled.", serialize_order(order))


def _save_address(*, user, payload: AddressIn, instance: Address | None = None) -> Address:
    delivery = build_delivery_service()
    geo = delivery.resolve_address(
        address=payload.formatted_address or payload.line1 or None,
        place_id=payload.place_id or None,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    delivery.require_serviceable(geo)

    components = geo.address_components or []
    line1 = payload.line1.strip() or _component_value(components, "route") or geo.formatted_address
    city = payload.city.strip() or _component_value(components, "locality") or "Dubai"
    region = payload.region.strip() or _component_value(components, "administrative_area_level_1")
    postal = normalize_postal_code(geo.postal_code or payload.postal_code or "")
    if not line1:
        raise ValidationError({"address": ErrorMessage.VALIDATION})

    make_default = True if instance is None else payload.is_default
    if make_default:
        others = Address.objects.filter(user=user)
        if instance is not None:
            others = others.exclude(pk=instance.pk)
        others.update(is_default=False)

    address = instance or Address(user=user)
    address.line1 = line1[:200]
    address.line2 = payload.line2.strip()[:200]
    address.city = city[:120]
    address.region = region[:120]
    address.postal_code = postal[:20]
    address.country = (payload.country or "AE").upper()[:2]
    address.latitude = geo.latitude
    address.longitude = geo.longitude
    address.place_id = (geo.place_id or payload.place_id or "")[:256]
    address.formatted_address = (geo.formatted_address or payload.formatted_address or line1)[:400]
    if instance is None or payload.is_default:
        address.is_default = make_default
    address.save()
    return address


def _address_payload(address: Address) -> dict:
    return {
        "id": address.id,
        "line1": address.line1,
        "line2": address.line2,
        "city": address.city,
        "region": address.region,
        "postal_code": address.postal_code,
        "country": address.country,
        "place_id": address.place_id,
        "formatted_address": address.formatted_address,
        "latitude": str(address.latitude) if address.latitude is not None else None,
        "longitude": str(address.longitude) if address.longitude is not None else None,
        "is_default": address.is_default,
    }
