from ninja import Query
from ninja_extra import ControllerBase, api_controller, route, status
from ninja_extra.exceptions import NotFound, ValidationError
from ninja_extra.permissions import AllowAny, IsAuthenticated
from accounts.auth import SessionJWTAuth, optional_user

from commerce.cart import CartLineCommand
from commerce.factory import build_cart_service, build_delivery_service, build_order_service
from commerce.models import Address, PaymentMethod, normalize_postal_code
from commerce.orders import PlaceOrderCommand, request_hash_for, serialize_order, stripe_checkout_idempotency_key
from commerce.stripe_payments import (
    StripeNotConfigured,
    create_checkout_intent,
    create_hosted_checkout_session,
    mark_order_paid,
    payment_intent_id_from_session,
    require_stripe_available,
    retrieve_checkout_session,
    retrieve_payment_intent,
    stripe_enabled,
    stripe_publishable_key,
    sync_order_from_intent,
    uses_stripe_payment,
    verify_webhook,
)
from commerce.pricing import preview_coupons, quote_variants, serialize_offer_rules
from commerce.schemas import (
    AddressIn,
    AutocompleteIn,
    CartItemIn,
    CartMergeIn,
    CartSyncIn,
    CheckoutValidateIn,
    DeliveryCheckIn,
    PlaceOrderIn,
    PriceQuoteIn,
    StripeCheckoutCompleteIn,
    StripeCheckoutSessionIn,
    StripeIntentIn,
)
from core.exceptions import Conflict
from core.messages import ErrorMessage
from core.money import money
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
                "status": slot.status,
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
        user = optional_user(self.context.request)
        quoted = quote_variants(
            [(item.variant_id, item.quantity) for item in payload.items],
            code=payload.discount_code,
            user=user,
        )
        return success("Quote ready.", quoted.as_dict())

    @route.post("/coupons/preview", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Preview coupon eligibility")
    def coupon_preview(self, payload: PriceQuoteIn):
        from catalog.models import ProductVariant

        user = optional_user(self.context.request)
        wanted = {item.variant_id: item.quantity for item in payload.items if item.quantity > 0}
        variants = ProductVariant.objects.select_related("product").filter(pk__in=wanted)
        lines = []
        for variant in variants:
            quantity = wanted[variant.id]
            lines.append((variant, quantity, money(variant.price) * quantity))
        rows = preview_coupons(lines, user=user)
        return success("Coupon preview ready.", rows)


@api_controller("/payments", tags=["Payments"], auth=None, permissions=[AllowAny], use_unique_op_id=False)
class PaymentController(ControllerBase):
    @route.get("/methods", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="List payment methods")
    def methods(self):
        rows = []
        for method in PaymentMethod.objects.order_by("-is_active", "name"):
            is_active = method.is_active
            if uses_stripe_payment(method.code) and not stripe_enabled():
                is_active = False
            rows.append({"code": method.code, "name": method.name, "is_active": is_active})
        return success("Payment methods retrieved.", rows)

    @route.get("/stripe/config", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Stripe publishable key")
    def stripe_config(self):
        key = stripe_publishable_key()
        if not key:
            raise NotFound(ErrorMessage.NOT_FOUND)
        return success("Stripe config retrieved.", {"publishable_key": key})

    @route.post(
        "/stripe/intent",
        auth=SessionJWTAuth(),
        permissions=[IsAuthenticated],
        response={200: SuccessResponse, **_ERROR_RESPONSES},
        summary="Prepare Stripe payment before checkout",
    )
    def stripe_intent(self, payload: StripeIntentIn):
        from django.conf import settings

        from catalog.models import ProductStatus, ProductVariant

        from commerce.pricing import quote_lines

        require_stripe_available()
        user = self.context.request.user
        cart = build_cart_service().get_or_create(user)
        items = list(cart.items.select_related("variant", "variant__product").all())
        if not items:
            raise ValidationError({"cart": "Your cart is empty."})
        quantities: dict[int, int] = {}
        for item in items:
            quantities[item.variant_id] = quantities.get(item.variant_id, 0) + item.quantity
        variants = list(ProductVariant.objects.select_related("product").filter(pk__in=quantities))
        if len(variants) != len(quantities):
            raise ValidationError({"stock": ErrorMessage.OUT_OF_STOCK})
        priced = []
        for variant in variants:
            qty = quantities[variant.id]
            if (
                not variant.is_active
                or variant.product.status != ProductStatus.ACTIVE
                or variant.on_hand < qty
            ):
                raise ValidationError({"stock": ErrorMessage.OUT_OF_STOCK})
            priced.append((variant, qty, money(variant.price) * qty))
        quoted = quote_lines(priced, code=payload.discount_code, user=user)
        if money(payload.expected_total) != quoted.total:
            raise Conflict(ErrorMessage.TOTAL_MISMATCH)
        intent = create_checkout_intent(
            total=quoted.total,
            currency=settings.DEFAULT_CURRENCY,
            user_id=user.id,
        )
        return success(
            "Payment session ready.",
            {"client_secret": intent.client_secret, "payment_intent_id": intent.id},
        )

    @route.post(
        "/stripe/checkout-session",
        auth=SessionJWTAuth(),
        permissions=[IsAuthenticated],
        response={200: SuccessResponse, **_ERROR_RESPONSES},
        summary="Start Stripe hosted checkout",
    )
    def stripe_checkout_session(self, payload: StripeCheckoutSessionIn):
        from django.conf import settings

        require_stripe_available()
        if not uses_stripe_payment(payload.payment_method):
            raise ValidationError({"payment_method": "That payment method does not use Stripe checkout."})

        user = self.context.request.user
        command = PlaceOrderCommand(
            address_id=payload.address_id,
            delivery_date=payload.delivery_date,
            window_id=payload.window_id,
            window_source=payload.window_source,
            note=payload.note,
            expected_total=payload.expected_total,
            discount_code=payload.discount_code,
            payment_method=payload.payment_method,
        )
        from decimal import Decimal

        quote = build_order_service().validate(user, command, match_total=True)
        total = Decimal(str(quote["total"]))
        metadata = {
            "user_id": str(user.id),
            "address_id": str(payload.address_id),
            "delivery_date": payload.delivery_date.isoformat(),
            "window_id": str(payload.window_id),
            "window_source": payload.window_source,
            "payment_method": payload.payment_method,
            "discount_code": (payload.discount_code or "").strip(),
            "note": payload.note,
            "expected_total": str(total),
        }
        base = settings.FRONTEND_URL.rstrip("/")
        session = create_hosted_checkout_session(
            total=total,
            currency=settings.DEFAULT_CURRENCY,
            user_id=user.id,
            metadata=metadata,
            success_url=f"{base}/checkout/complete?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{base}/checkout?cancelled=1",
        )
        if not session.url:
            raise ValidationError({"stripe": "Stripe checkout could not be started."})
        return success("Stripe checkout ready.", {"url": session.url, "session_id": session.id})

    @route.post(
        "/stripe/checkout-complete",
        auth=SessionJWTAuth(),
        permissions=[IsAuthenticated],
        response={200: SuccessResponse, **_ERROR_RESPONSES},
        summary="Complete order after Stripe hosted checkout",
    )
    def stripe_checkout_complete(self, payload: StripeCheckoutCompleteIn):
        from datetime import date

        from commerce.models import Order

        user = self.context.request.user
        session = retrieve_checkout_session(payload.session_id)
        metadata = session.metadata or {}
        if str(metadata.get("user_id")) != str(user.id):
            raise ValidationError({"session": "Invalid payment session."})
        if session.payment_status != "paid":
            raise ValidationError({"payment": "Payment has not completed yet."})

        intent_id = payment_intent_id_from_session(session)
        if not intent_id:
            raise ValidationError({"payment": "Payment could not be confirmed."})

        existing = Order.objects.filter(stripe_payment_intent_id=intent_id).first()
        if existing is not None:
            return success("Order placed.", serialize_order(existing))

        discount_code = (metadata.get("discount_code") or "").strip() or None
        command = PlaceOrderCommand(
            address_id=int(metadata["address_id"]),
            delivery_date=date.fromisoformat(metadata["delivery_date"]),
            window_id=int(metadata["window_id"]),
            window_source=metadata.get("window_source") or "weekly",
            note=metadata.get("note") or "",
            expected_total=money(metadata["expected_total"]),
            discount_code=discount_code,
            payment_method=metadata.get("payment_method") or "card",
            stripe_payment_intent_id=intent_id,
        )
        body = {
            "address_id": command.address_id,
            "delivery_date": command.delivery_date.isoformat(),
            "window_id": command.window_id,
            "window_source": command.window_source,
            "note": command.note,
            "expected_total": str(command.expected_total),
            "discount_code": command.discount_code,
            "payment_method": command.payment_method,
            "stripe_payment_intent_id": intent_id,
        }
        order = build_order_service().place(
            user,
            command,
            idempotency_key=stripe_checkout_idempotency_key(payload.session_id),
            request_hash=request_hash_for(body),
        )
        return success("Order placed.", serialize_order(order))

    @route.post("/stripe/webhook", auth=None, permissions=[AllowAny], summary="Stripe webhook")
    def stripe_webhook(self):
        from commerce.models import Order

        request = self.context.request
        try:
            event = verify_webhook(request.body, request.headers.get("Stripe-Signature"))
        except StripeNotConfigured:
            raise NotFound(ErrorMessage.NOT_FOUND)
        except Exception:
            raise ValidationError({"stripe": "Invalid webhook signature."})

        if event.type == "payment_intent.succeeded":
            intent = event.data.object
            metadata = intent.metadata or {}
            order_number = metadata.get("order_number")
            order = None
            if order_number:
                order = Order.objects.filter(number=order_number).first()
            if order is None:
                order = Order.objects.filter(stripe_payment_intent_id=intent.id).first()
            if order is not None:
                mark_order_paid(order, payment_intent_id=intent.id)
        return success("Webhook received.", {"received": True})


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

    @route.post("/validate", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Validate checkout before payment")
    def validate_checkout(self, payload: CheckoutValidateIn):
        from decimal import Decimal

        command = PlaceOrderCommand(
            address_id=payload.address_id,
            delivery_date=payload.delivery_date,
            window_id=payload.window_id,
            window_source=payload.window_source,
            note="",
            expected_total=payload.expected_total or Decimal("0"),
            discount_code=payload.discount_code,
            payment_method=payload.payment_method,
        )
        quote = build_order_service().validate(
            self.context.request.user,
            command,
            match_total=payload.expected_total is not None,
        )
        return success("Checkout is ready.", quote)

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
                stripe_payment_intent_id=payload.stripe_payment_intent_id,
            ),
            idempotency_key=key,
            request_hash=request_hash_for(body),
        )
        return status.HTTP_201_CREATED, success("Order placed.", serialize_order(order))

    @route.get("/{number}", response={200: SuccessResponse, **_ERROR_RESPONSES}, summary="Get an order")
    def retrieve(self, number: str):
        order = build_order_service().get_for(self.context.request.user, number=number)
        return success("Order retrieved.", serialize_order(order))

    @route.post(
        "/{number}/confirm-payment",
        response={200: SuccessResponse, **_ERROR_RESPONSES},
        summary="Confirm card payment for an order",
    )
    def confirm_payment(self, number: str):
        from commerce.models import Order, PaymentStatus

        order = build_order_service().get_for(self.context.request.user, number=number)
        if not uses_stripe_payment(order.payment_method) or not order.stripe_payment_intent_id:
            raise ValidationError({"payment": "This order does not require online payment."})
        if order.payment_status == PaymentStatus.PAID:
            return success("Payment already confirmed.", serialize_order(order))
        intent = retrieve_payment_intent(order.stripe_payment_intent_id)
        order = sync_order_from_intent(order, intent)
        if order.payment_status != PaymentStatus.PAID:
            raise ValidationError({"payment": "Payment has not completed yet."})
        return success("Payment confirmed.", serialize_order(order))

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
    community = payload.community.strip()
    building = payload.building.strip()
    unit = payload.unit.strip()
    floor = payload.floor.strip()
    provided_details = bool(community or building or unit or floor)
    if instance is not None and not provided_details:
        community = instance.community
        building = instance.building
        unit = instance.unit
        floor = instance.floor
        label = instance.label or payload.label
    else:
        missing = {}
        if not community:
            missing["community"] = "Community / area is required."
        if not building:
            missing["building"] = "Building / villa name is required."
        if not unit:
            missing["unit"] = "Apartment / villa number is required."
        if missing:
            raise ValidationError(missing)
        label = payload.label

    address.line1 = line1[:200]
    address.line2 = payload.line2.strip()[:200] or ", ".join(
        part for part in [unit, f"Floor {floor}" if floor else ""] if part
    )[:200]
    address.city = city[:120]
    address.region = region[:120] or community[:120]
    address.postal_code = postal[:20]
    address.country = (payload.country or "AE").upper()[:2]
    address.latitude = geo.latitude
    address.longitude = geo.longitude
    address.place_id = (geo.place_id or payload.place_id or "")[:256]
    address.formatted_address = (geo.formatted_address or payload.formatted_address or line1)[:400]
    address.label = label
    address.community = community[:120]
    address.building = building[:120]
    address.unit = unit[:80]
    address.floor = floor[:40]
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
        "label": address.label,
        "community": address.community,
        "building": address.building,
        "unit": address.unit,
        "floor": address.floor,
    }
