"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { ActionState } from "@/lib/action-state";
import { placeOrderAction } from "@/lib/actions";
import { emptyActionState, SubmitButton } from "@/components/ActionForm";
import { AddressPicker } from "@/components/AddressPicker";
import { useToast } from "@/components/Toast";
import { useCart } from "@/components/CartProvider";
import { cartSubtotal, markCartForClear, toSyncPayload } from "@/lib/cart-store";

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
      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition hover:-translate-y-px hover:border-forest/40 ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      } ${checked ? "border-forest bg-white/80" : "border-line"}`}
    >
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onChange} className="mt-1" />
      <span>
        <span className="block font-medium text-forest">{title}</span>
        {detail ? <span className="mt-0.5 block text-sm text-ink/65">{detail}</span> : null}
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
  const toast = useToast();
  const { items, subtotal, flush } = useCart();
  const defaultAddress = addresses.find((row) => row.is_default) || addresses[0];
  const activePayments = paymentMethods.filter((row) => row.is_active);
  const [addressId, setAddressId] = useState<number | "">(defaultAddress?.id || "");
  const [slotId, setSlotId] = useState(slots[0] ? slotKey(slots[0]) : "");
  const [paymentMethod, setPaymentMethod] = useState(activePayments[0]?.code || "");
  const [panel, setPanel] = useState<"pick" | "add" | "edit">(addresses.length ? "pick" : "add");

  const selectedAddress = useMemo(
    () => addresses.find((row) => row.id === addressId) || defaultAddress,
    [addressId, addresses, defaultAddress],
  );
  const selectedSlot = useMemo(
    () => slots.find((row) => slotKey(row) === slotId) || slots[0],
    [slotId, slots],
  );

  const [state, formAction] = useActionState(async (prev: ActionState, formData: FormData) => {
    await flush();
    markCartForClear();
    formData.set("cart_json", JSON.stringify(toSyncPayload(items)));
    formData.set("expected_total", subtotal || cartSubtotal(items));
    return placeOrderAction(prev, formData);
  }, emptyActionState);

  useEffect(() => {
    void flush();
  }, [flush]);

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

  const canPlace = Boolean(selectedAddress && selectedSlot && paymentMethod && items.length);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
      <section className="space-y-6">
        <div className="card-quiet rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-forest">Delivery address</h2>
            {panel === "pick" && addresses.length ? (
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary px-3 py-2 text-sm" onClick={() => setPanel("add")}>
                  Add address
                </button>
                {selectedAddress ? (
                  <button type="button" className="btn btn-secondary px-3 py-2 text-sm" onClick={() => setPanel("edit")}>
                    Edit
                  </button>
                ) : null}
              </div>
            ) : null}
            {panel === "edit" ? (
              <button
                type="button"
                className="text-sm font-semibold text-citrus hover:underline"
                onClick={() => setPanel("pick")}
              >
                Cancel
              </button>
            ) : null}
            {panel === "add" && addresses.length ? (
              <button
                type="button"
                className="text-sm font-semibold text-citrus hover:underline"
                onClick={() => setPanel("pick")}
              >
                Cancel
              </button>
            ) : null}
          </div>

          <p className="mt-2 text-sm text-ink/65">Delivery is available in Dubai only. Outside areas can still be searched for testing; postal-code checks decide if we can save them.</p>

          {panel === "pick" && addresses.length ? (
            <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Saved addresses">
              {addresses.map((address) => (
                <ChoiceCard
                  key={address.id}
                  name="saved_address"
                  value={String(address.id)}
                  checked={address.id === selectedAddress?.id}
                  title={address.formatted_address || `${address.line1}, ${address.city}`}
                  detail={address.is_default ? "Default" : address.city}
                  onChange={() => {
                    setAddressId(address.id);
                    setPanel("pick");
                  }}
                />
              ))}
            </div>
          ) : null}

          {panel === "add" ? (
            <>
              <p className="mt-3 text-sm text-ink/65">
                Search worldwide, then we check the pin code. Tap the location icon to use your current place.
              </p>
              <AddressPicker onSaved={() => setPanel("pick")} />
            </>
          ) : null}

          {panel === "edit" && selectedAddress ? (
            <>
              <p className="mt-3 text-sm text-ink/65">Search for a new place, or keep this one and save.</p>
              <AddressPicker
                key={selectedAddress.id}
                addressId={selectedAddress.id}
                isDefault={Boolean(selectedAddress.is_default)}
                submitLabel="Update address"
                initialQuery={selectedAddress.formatted_address || selectedAddress.line1}
                initialPlace={{
                  place_id: selectedAddress.place_id,
                  latitude: selectedAddress.latitude,
                  longitude: selectedAddress.longitude,
                  postal_code: selectedAddress.postal_code,
                  formatted_address: selectedAddress.formatted_address || selectedAddress.line1,
                }}
                onSaved={() => setPanel("pick")}
              />
            </>
          ) : null}
        </div>

        <div className="card-quiet rounded-2xl p-6">
          <h2 className="font-semibold text-forest">Delivery window</h2>
          {slots.length ? (
            <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Delivery windows">
              {slots.map((slot) => (
                <ChoiceCard
                  key={slotKey(slot)}
                  name="saved_slot"
                  value={slotKey(slot)}
                  checked={selectedSlot ? slotKey(slot) === slotKey(selectedSlot) : false}
                  title={`${formatDay(slot.date)} · ${formatClock(slot.start_time)}–${formatClock(slot.end_time)}`}
                  detail={`${slot.remaining} left`}
                  onChange={() => setSlotId(slotKey(slot))}
                />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink/65">No open windows right now.</p>
          )}
        </div>

        <div className="card-quiet rounded-2xl p-6">
          <h2 className="font-semibold text-forest">Payment</h2>
          <p className="mt-2 text-sm text-ink/65">Choose how you will pay. Only available methods can be selected.</p>
          <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Payment methods">
            {paymentMethods.map((method) => (
              <ChoiceCard
                key={method.code}
                name="saved_payment"
                value={method.code}
                checked={paymentMethod === method.code}
                disabled={!method.is_active}
                title={method.name}
                detail={method.is_active ? "Available" : "Coming soon"}
                onChange={() => {
                  if (method.is_active) setPaymentMethod(method.code);
                }}
              />
            ))}
            {!paymentMethods.length ? <p className="text-sm text-ink/65">No payment methods are available.</p> : null}
          </div>
        </div>
      </section>

      <section className="cart-summary !top-24">
        <h2 className="font-semibold text-forest">Place order</h2>
        <p className="mt-2 text-sm text-ink/65">Your browser cart is synced right before we place it.</p>

        <ul className="mt-5 divide-y divide-line border-y border-line">
          {items.map((item) => (
            <li key={item.variant_id} className="flex items-start justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-forest">{item.title}</p>
                <p className="mt-0.5 text-ink/60">
                  {item.quantity} × AED {item.unit_price}
                </p>
              </div>
              <p className="shrink-0 tabular-nums">AED {lineTotal(item.unit_price, item.quantity)}</p>
            </li>
          ))}
          {!items.length ? <li className="py-4 text-sm text-ink/60">Your cart is empty.</li> : null}
        </ul>

        <div className="mt-3 flex items-center justify-between text-sm font-semibold text-forest">
          <span>Total</span>
          <span className="tabular-nums">AED {subtotal}</span>
        </div>
        <p className="mt-1 text-xs text-ink/55">Rechecked on the server before payment.</p>

        <form action={formAction} className="mt-5 grid gap-3">
          <input type="hidden" name="address_id" value={selectedAddress?.id || ""} />
          <input type="hidden" name="delivery_date" value={selectedSlot?.date || ""} />
          <input type="hidden" name="window_id" value={selectedSlot?.window_id || ""} />
          <input type="hidden" name="window_source" value={selectedSlot?.source || "weekly"} />
          <input type="hidden" name="payment_method" value={paymentMethod} />
          <label className="field">
            <span>Delivery note</span>
            <textarea name="note" rows={3} />
          </label>
          <SubmitButton className="btn btn-primary" pendingLabel="Placing order…" disabled={!canPlace}>
            Place order
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}
