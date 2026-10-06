"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";
import { placeOrderAction, setPrimaryAddressAction } from "@/lib/actions";
import { emptyActionState, SubmitButton } from "@/components/ActionForm";
import { AddressPicker } from "@/components/AddressPicker";
import { useToast } from "@/components/Toast";
import { OpenBasketLink } from "@/components/OpenBasketLink";
import { OrderSummary } from "@/components/OrderSummary";
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
};

export type CheckoutPaymentMethod = {
  code: string;
  name: string;
  is_active: boolean;
};

function slotKey(slot: CheckoutSlot) {
  return `${slot.date}|${slot.window_id}|${slot.source}`;
}

function formatClock(value: string) {
  return value.slice(0, 5);
}

function formatDay(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}

function isToday(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  const now = new Date();
  return (
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate()
  );
}

function lineTotal(unitPrice: string, quantity: number) {
  return (Number(unitPrice) * quantity).toFixed(2);
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
  const activePayments = paymentMethods.filter((row) => row.is_active);
  const [addressId, setAddressId] = useState<number | "">(defaultAddress?.id || "");
  const [slotId, setSlotId] = useState(slots[0] ? slotKey(slots[0]) : "");
  const [whenMode, setWhenMode] = useState<"now" | "schedule">("now");
  const [paymentMethod, setPaymentMethod] = useState(activePayments[0]?.code || "");
  const [panel, setPanel] = useState<"pick" | "add" | "edit">(addresses.length ? "pick" : "add");
  const [addressOpen, setAddressOpen] = useState(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const selectedAddress = useMemo(
    () => addresses.find((row) => row.id === addressId) || defaultAddress,
    [addressId, addresses, defaultAddress],
  );
  const selectedSlot = useMemo(() => slots.find((row) => slotKey(row) === slotId) || slots[0], [slotId, slots]);
  const activeSlot = whenMode === "now" ? slots[0] : selectedSlot;

  const [state, formAction] = useActionState(async (prev: ActionState, formData: FormData) => {
    await flush();
    await refreshQuote();
    formData.set("cart_json", JSON.stringify(toSyncPayload(itemsRef.current)));
    formData.set("expected_total", quote.total);
    formData.set("discount_code", discountCode.trim());
    return placeOrderAction(prev, formData);
  }, emptyActionState);

  useEffect(() => {
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

  const canPlace = Boolean(selectedAddress && activeSlot && paymentMethod && items.length);

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

  const nowDetail = slots[0]
    ? isToday(slots[0].date)
      ? "Arrives in about 30 minutes"
      : `Arrives ${formatDay(slots[0].date)}`
    : "No open windows right now";

  return (
    <>
      <div className="checkout-intro">
        <OpenBasketLink className="back-link">Back to basket</OpenBasketLink>
        <h1>Checkout</h1>
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
                <strong>{selectedAddress.is_default ? "Primary address" : "Saved address"}</strong>
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
                  title={address.is_default ? "Primary address" : address.city || "Address"}
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
            <p className="fine-print">Delivery is available in Dubai. We check the pin code before an address can be saved.</p>
          ) : null}
          {panel === "add" ? (
            <>
              <p className="fine-print">Delivery is available in Dubai. We check the pin code before an address can be saved.</p>
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
          <h2>When</h2>
          <div className="when-grid" role="radiogroup" aria-label="When to deliver">
            <div
              role="radio"
              aria-checked={whenMode === "now"}
              tabIndex={0}
              className={`pick-card ${whenMode === "now" ? "pick-card-on" : ""} ${slots.length ? "" : "is-disabled"}`}
              onClick={() => slots.length && setWhenMode("now")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  if (slots.length) setWhenMode("now");
                }
              }}
            >
              <input type="radio" checked={whenMode === "now"} readOnly tabIndex={-1} aria-hidden="true" />
              <span>
                <strong>Now</strong>
                <small>{nowDetail}</small>
              </span>
            </div>
            <div
              role="radio"
              aria-checked={whenMode === "schedule"}
              tabIndex={0}
              className={`pick-card ${whenMode === "schedule" ? "pick-card-on" : ""} ${slots.length ? "" : "is-disabled"}`}
              onClick={() => slots.length && setWhenMode("schedule")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  if (slots.length) setWhenMode("schedule");
                }
              }}
            >
              <input type="radio" checked={whenMode === "schedule"} readOnly tabIndex={-1} aria-hidden="true" />
              <span>
                <strong>Schedule</strong>
                <small>Choose a delivery slot</small>
              </span>
            </div>
          </div>
          {whenMode === "schedule" && slots.length ? (
            <div className="choice-stack" role="radiogroup" aria-label="Delivery windows">
              {slots.map((slot) => (
                <ChoiceCard
                  key={slotKey(slot)}
                  name="saved_slot"
                  value={slotKey(slot)}
                  checked={activeSlot ? slotKey(slot) === slotKey(activeSlot) : false}
                  title={`${formatDay(slot.date)} · ${formatClock(slot.start_time)}–${formatClock(slot.end_time)}`}
                  detail={`${slot.remaining} left`}
                  onChange={() => setSlotId(slotKey(slot))}
                />
              ))}
            </div>
          ) : null}
        </section>

        <section className="checkout-block" id="pay">
          <p className="step-index">03</p>
          <h2>Pay with</h2>
          <div className="choice-stack" role="radiogroup" aria-label="Payment methods">
            {paymentMethods.map((method) => (
              <ChoiceCard
                key={method.code}
                name="saved_payment"
                value={method.code}
                checked={paymentMethod === method.code}
                disabled={!method.is_active}
                title={method.name}
                detail={method.is_active ? undefined : "Coming soon"}
                onChange={() => {
                  if (method.is_active) setPaymentMethod(method.code);
                }}
              />
            ))}
            {!paymentMethods.length ? <p className="fine-print">No payment methods are available.</p> : null}
          </div>
        </section>

        <section className="checkout-block">
          <p className="step-index">04</p>
          <h2>Delivery note</h2>
          <label className="field">
            <span className="sr-only">Delivery note</span>
            <textarea name="note" form="place-order" rows={3} placeholder="Leave at the door, call on arrival..." />
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
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image_url} alt="" />
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
