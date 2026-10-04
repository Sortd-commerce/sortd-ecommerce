"use client";

import { useActionState, useEffect } from "react";
import type { ActionState } from "@/lib/action-state";
import { placeOrderAction } from "@/lib/actions";
import { emptyActionState } from "@/components/ActionForm";
import { SubmitButton } from "@/components/ActionForm";
import { useCart } from "@/components/CartProvider";
import { markCartForClear, toSyncPayload } from "@/lib/cart-store";

export function CheckoutForm({
  addressId,
  date,
  windowId,
  windowSource,
  disabled,
}: {
  addressId: number | "";
  date: string;
  windowId: number | "";
  windowSource: string;
  disabled: boolean;
}) {
  const { items, subtotal, flush } = useCart();
  const [state, formAction] = useActionState(async (prev: ActionState, formData: FormData) => {
    await flush();
    markCartForClear();
    formData.set("cart_json", JSON.stringify(toSyncPayload(items)));
    formData.set("expected_total", subtotal);
    return placeOrderAction(prev, formData);
  }, emptyActionState);

  useEffect(() => {
    void flush();
  }, [flush]);

  return (
    <form action={formAction} className="mt-5 grid gap-3">
      <label className="field">
        <span>Address ID</span>
        <input name="address_id" defaultValue={addressId || ""} required />
      </label>
      <label className="field">
        <span>Delivery date</span>
        <input name="delivery_date" defaultValue={date} required />
      </label>
      <label className="field">
        <span>Window ID</span>
        <input name="window_id" defaultValue={windowId || ""} required />
      </label>
      <input type="hidden" name="window_source" value={windowSource} />
      <p className="text-sm text-ink/70">Total AED {subtotal} — rechecked on the server.</p>
      <label className="field">
        <span>Delivery note</span>
        <textarea name="note" rows={3} />
      </label>
      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-leaf" : "text-citrus"}`} role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="btn btn-primary" pendingLabel="Placing order…" disabled={disabled || !items.length}>
        Place COD order
      </SubmitButton>
    </form>
  );
}
