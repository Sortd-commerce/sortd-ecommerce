"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";
import { placeOrderAction, setPrimaryAddressAction } from "@/lib/actions";
import { emptyActionState, SubmitButton } from "@/components/ActionForm";
import { AddressPicker } from "@/components/AddressPicker";
import { useToast } from "@/components/Toast";
import { DeliverySlotPicker } from "@/components/DeliverySlotPicker";
import { OpenBasketLink } from "@/components/OpenBasketLink";
import { OrderSummary } from "@/components/OrderSummary";
import { StripePaymentForm } from "@/components/StripePaymentForm";
import { OptimizedImage } from "@/components/OptimizedImage";
import { usePricing } from "@/components/PricingProvider";
import { useCart } from "@/components/CartProvider";
import { toSyncPayload } from "@/lib/cart-store";

export type CheckoutAddress = {
  id: number;
  line1: string;
  city: string;
  formatted_address: string;
  is_default?: boolean;
  place_id?: string;
  latitude?: string | null;
  longitude?: string | null;
  postal_code?: string;
};

export type CheckoutSlot = {
  date: string;
  start_time: string;
  end_time: string;
  remaining: number;
  window_id: number;
  source: string;
  status: "available" | "passed" | "full";
};

export type CheckoutPaymentMethod = {
  code: string;
  name: string;
  is_active: boolean;
};

function slotKey(slot: CheckoutSlot) {
  return `${slot.date}|${slot.window_id}|${slot.source}`;
}

function lineTotal(unitPrice: string, quantity: number) {
  return (Number(unitPrice) * quantity).toFixed(2);
}

const PAYMENT_NAME: Record<string, string> = {
  cod: "Cash on delivery",
  card: "Credit or debit card",
};

const PAYMENT_DETAIL: Record<string, string> = {
  cod: "Pay the rider at your door",
  card: "Visa, Mastercard, Amex",
};

function firstAvailableSlot(slots: CheckoutSlot[]) {
  return slots.find((row) => row.status === "available" && row.remaining > 0) || null;
}

function addressLabel(address: CheckoutAddress) {
  return address.is_default ? "Home" : address.line1 || address.city || "Address";
}

function ChoiceCard({
  name,
  value,
  checked,
  disabled,
  title,
  detail,
  onChange,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  title: string;
  detail?: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`pick-card ${checked ? "pick-card-on" : ""} ${disabled ? "is-disabled" : ""}`}
      onClick={() => {
        if (!disabled) onChange();
      }}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
      />
      <span>
        <strong>{title}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
    </label>
  );
}

export function CheckoutForm({
  addresses,
  slots,
  paymentMethods,
}: {
  addresses: CheckoutAddress[];
  slots: CheckoutSlot[];
  paymentMethods: CheckoutPaymentMethod[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { items, count, flush } = useCart();
  const itemsRef = useRef(items);
  const { quote, discountCode, refreshQuote } = usePricing();
  const [settingPrimary, startPrimary] = useTransition();
  const defaultAddress = addresses.find((row) => row.is_default) || addresses[0];
  const checkoutPayments = paymentMethods.filter((row) => row.code === "cod" || row.code === "card");
  const activePayments = checkoutPayments.filter((row) => row.is_active);
  const [addressId, setAddressId] = useState<number | "">(defaultAddress?.id || "");
  const [slotId, setSlotId] = useState(() => {
    const first = firstAvailableSlot(slots);
    return first ? slotKey(first) : "";
  });
  const [paymentMethod, setPaymentMethod] = useState(activePayments[0]?.code || "");
  const [panel, setPanel] = useState<"pick" | "add" | "edit">(addresses.length ? "pick" : "add");
  const [addressOpen, setAddressOpen] = useState(false);
  const [cardPayment, setCardPayment] = useState<{ clientSecret: string; orderNumber: string } | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const selectedAddress = useMemo(
    () => addresses.find((row) => row.id === addressId) || defaultAddress,
    [addressId, addresses, defaultAddress],
  );
  const selectedSlot = useMemo(
    () => slots.find((row) => slotKey(row) === slotId) || firstAvailableSlot(slots),
    [slotId, slots],
  );
  const activeSlot = selectedSlot?.status === "available" ? selectedSlot : firstAvailableSlot(slots);

  const [state, formAction] = useActionState(async (prev: ActionState, formData: FormData) => {
    await flush();
    await refreshQuote();
    formData.set("cart_json", JSON.stringify(toSyncPayload(itemsRef.current)));
    formData.set("expected_total", quote.total);
    formData.set("discount_code", discountCode.trim());
    return placeOrderAction(prev, formData);
  }, emptyActionState);

  useEffect(() => {
    if (state.ok && state.clientSecret && state.orderNumber) {
      setCardPayment({ clientSecret: state.clientSecret, orderNumber: state.orderNumber });
      return;
    }
    if (!state.message || state.ok) return;
    toast.error(state.message);
  }, [state, toast]);

  useEffect(() => {
    if (!addresses.length) {
      setPanel("add");
      return;
    }
    if (!addresses.some((row) => row.id === addressId)) {
      setAddressId(defaultAddress?.id || addresses[0].id);
    }
  }, [addresses, addressId, defaultAddress]);

  const canPlace = Boolean(selectedAddress && activeSlot && paymentMethod && items.length && !cardPayment);

  function onAddressSaved() {
    setPanel("pick");
    setAddressOpen(false);
    router.refresh();
  }

  function makePrimary(address: CheckoutAddress) {
    startPrimary(async () => {
      const result = await setPrimaryAddressAction(address.id);
      if (result.ok) {
        toast.success(result.message);
        setAddressId(address.id);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <div className="checkout-intro">
        <OpenBasketLink className="back-link">Back to basket</OpenBasketLink>
      </div>
      <div className="checkout-layout">
      <div className="checkout-steps-col">
        <section className="checkout-block">
          <div className="checkout-block-head">
            <div className="checkout-block-title">
              <p className="step-index">01</p>
              <h2>Deliver to</h2>
              {!addresses.length && panel === "pick" ? (
                <p className="fine-print">Add your primary delivery address to continue.</p>
              ) : null}
            </div>
            {panel === "pick" && addressOpen ? (
              <button type="button" className="checkout-done" onClick={() => setAddressOpen(false)}>
                Done
              </button>
            ) : null}
            {(panel === "add" || panel === "edit") && addresses.length ? (
              <button
                type="button"
                className="checkout-cancel"
                onClick={() => {
                  setPanel("pick");
                  setAddressOpen(false);
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
          {panel === "pick" && !addressOpen && selectedAddress ? (
            <div className="pick-card pick-card-on address-summary">
              <input type="radio" checked readOnly tabIndex={-1} aria-label="Selected address" />
              <span>
                <strong>{addressLabel(selectedAddress)}</strong>
                <small>{selectedAddress.formatted_address || `${selectedAddress.line1}, ${selectedAddress.city}`}</small>
              </span>
              <button type="button" className="text-action address-change" onClick={() => setAddressOpen(true)}>
                Change
              </button>
            </div>
          ) : null}
          {panel === "pick" && addressOpen ? (
            <div className="choice-stack address-picker-list" role="radiogroup" aria-label="Saved addresses">
              {addresses.map((address) => (
                <ChoiceCard
                  key={address.id}
                  name="saved_address"
                  value={String(address.id)}
                  checked={address.id === selectedAddress?.id}
                  title={addressLabel(address)}
                  detail={address.formatted_address || address.line1}
                  onChange={() => {
                    setAddressId(address.id);
                    setAddressOpen(false);
                  }}
                />
              ))}
            </div>
          ) : null}
          {panel === "pick" && selectedAddress && !selectedAddress.is_default && !addressOpen ? (
            <button
              type="button"
              className="text-action"
              disabled={settingPrimary}
              onClick={() => makePrimary(selectedAddress)}
            >
              Set as primary delivery address
            </button>
          ) : null}
          {panel === "pick" && !addressOpen ? (
            <button
              type="button"
              className="text-action add-address"
              onClick={() => {
                setAddressOpen(false);
                setPanel("add");
              }}
            >
              + Add a new address
            </button>
          ) : null}
          {panel === "pick" && !addressOpen ? (
            <p className="fine-print">We deliver across Dubai. Search for your building or use your location.</p>
          ) : null}
          {panel === "add" ? (
            <>
              <p className="fine-print">We deliver across Dubai. Search for your building or use your location.</p>
              <AddressPicker
                isDefault={addresses.length === 0}
                showPrimaryToggle={addresses.length > 0}
                submitLabel={addresses.length === 0 ? "Save primary address" : "Save address"}
                onSaved={onAddressSaved}
              />
            </>
          ) : null}
          {panel === "edit" && selectedAddress ? (
            <AddressPicker
              key={selectedAddress.id}
              addressId={selectedAddress.id}
              isDefault={Boolean(selectedAddress.is_default)}
              showPrimaryToggle
              submitLabel="Update address"
              initialQuery={selectedAddress.formatted_address || selectedAddress.line1}
              initialPlace={{
                place_id: selectedAddress.place_id,
                latitude: selectedAddress.latitude,
                longitude: selectedAddress.longitude,
                postal_code: selectedAddress.postal_code,
                formatted_address: selectedAddress.formatted_address || selectedAddress.line1,
              }}
              onSaved={onAddressSaved}
            />
          ) : null}
        </section>

        <section className="checkout-block">
          <p className="step-index">02</p>
          <h2>Delivery slot</h2>
          <DeliverySlotPicker
            slots={slots}
            value={activeSlot ? slotKey(activeSlot) : slotId}
            onChange={setSlotId}
          />
        </section>

        <section className="checkout-block" id="pay">
          <p className="step-index">03</p>
          <h2>Pay with</h2>
          {cardPayment ? (
            <StripePaymentForm
              clientSecret={cardPayment.clientSecret}
              orderNumber={cardPayment.orderNumber}
              onCancel={() => {
                const number = cardPayment.orderNumber;
                setCardPayment(null);
                router.push(`/orders/${number}`);
              }}
            />
          ) : (
            <div className="choice-stack" role="radiogroup" aria-label="Payment methods">
              {checkoutPayments.map((method) => (
                <ChoiceCard
                  key={method.code}
                  name="saved_payment"
                  value={method.code}
                  checked={paymentMethod === method.code}
                  disabled={!method.is_active}
                  title={PAYMENT_NAME[method.code] || method.name}
                  detail={method.is_active ? PAYMENT_DETAIL[method.code] || undefined : "Unavailable"}
                  onChange={() => {
                    if (method.is_active) setPaymentMethod(method.code);
                  }}
                />
              ))}
              {!checkoutPayments.length ? <p className="fine-print">No payment methods are available.</p> : null}
            </div>
          )}
        </section>

        <section className="checkout-block">
          <p className="step-index">04</p>
          <h2>Delivery note</h2>
          <label className="field">
            <span className="sr-only">Delivery note</span>
            <textarea name="note" form="place-order" rows={3} placeholder="Gate code, leave at door, call on arrival…" />
          </label>
        </section>
      </div>

      <form id="place-order" action={formAction} className="order-card">
        <input type="hidden" name="address_id" value={selectedAddress?.id || ""} />
        <input type="hidden" name="delivery_date" value={activeSlot?.date || ""} />
        <input type="hidden" name="window_id" value={activeSlot?.window_id || ""} />
        <input type="hidden" name="window_source" value={activeSlot?.source || "weekly"} />
        <input type="hidden" name="payment_method" value={paymentMethod} />
        <div className="order-card-head">
          <h2>Your order</h2>
          <span>
            {count} {count === 1 ? "item" : "items"}
          </span>
        </div>
        <ul className="order-lines">
          {items.map((item) => (
            <li key={item.variant_id}>
              <span className="order-thumb">
                {item.image_url ? (
                  <OptimizedImage
                    src={item.image_url}
                    alt=""
                    fill
                    sizes="54px"
                    className="object-contain"
                  />
                ) : (
                  <span>{item.title.slice(0, 1)}</span>
                )}
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>
                  {item.quantity} × AED {item.unit_price}
                </small>
              </span>
              <b>AED {lineTotal(item.unit_price, item.quantity)}</b>
            </li>
          ))}
          {!items.length ? <li className="order-empty">Your basket is empty.</li> : null}
        </ul>
        <OrderSummary showPromo className="checkout-summary" />
        <SubmitButton className="btn btn-primary checkout-submit" pendingLabel="Placing order…" disabled={!canPlace}>
          <span>Place order</span>
          <span>AED {quote.total} →</span>
        </SubmitButton>
        <p className="fine-print checkout-footnote">Every item in this order passed all four gates. Lab reports are on each product page.</p>
      </form>
    </div>
    </>
  );
}
