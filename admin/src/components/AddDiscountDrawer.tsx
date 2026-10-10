"use client";

import { useActionState, useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import { SubmitButton } from "@/components/ActionForm";
import { emptyActionState } from "@/lib/action-state";
import { createDiscountAction } from "@/lib/actions";

export function AddDiscountDrawer({ products }: { products: Array<{ id: number; title: string }> }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>Add discount</button>
      {open ? (
        <div className="drawer-layer">
          <button type="button" className="drawer-scrim" aria-label="Close add discount panel" onClick={() => setOpen(false)} />
          <aside
            className="drawer-panel drawer-panel--wide drawer-panel--enter"
            role="dialog"
            aria-modal="true"
            aria-label="Add automatic discount"
          >
            <div className="drawer-head">
              <div>
                <h2 className="text-lg font-semibold">Add automatic discount</h2>
                <p className="mt-1 text-sm text-muted">This discount applies at checkout without a promo code.</p>
              </div>
              <button type="button" className="drawer-close" aria-label="Close" onClick={() => setOpen(false)}>
                <X size={18} weight="bold" />
              </button>
            </div>
            <div className="drawer-body">
              <CreateDiscountForm products={products} onSuccess={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function CreateDiscountForm({
  products,
  onSuccess,
}: {
  products: Array<{ id: number; title: string }>;
  onSuccess: () => void;
}) {
  const [state, formAction] = useActionState(createDiscountAction, emptyActionState);

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [onSuccess, state.ok]);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="redirect_to" value="/delivery/discounts" />
      <label className="field">
        <span>Discount name</span>
        <input name="name" placeholder="Summer sale" required />
      </label>
      <label className="field">
        <span>Discount type</span>
        <select name="kind" defaultValue="percent">
          <option value="percent">Percentage</option>
          <option value="fixed">Fixed amount</option>
        </select>
      </label>
      <label className="field">
        <span>Value (currency amount or percentage)</span>
        <input name="value" type="number" min="0.01" step="0.01" defaultValue="10" required />
      </label>
      <label className="field">
        <span>Applies to</span>
        <select name="scope" defaultValue="all">
          <option value="all">Entire order</option>
          <option value="product">Specific product</option>
        </select>
      </label>
      <label className="field">
        <span>Product</span>
        <select name="product_id" defaultValue="">
          <option value="">Choose a product</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
        </select>
        <span className="text-xs text-muted">Only used when the discount applies to a specific product.</span>
      </label>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input name="is_active" type="checkbox" defaultChecked /> Active and available at checkout
      </label>
      <SubmitButton>Add discount</SubmitButton>
      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-accent" : "text-warn"}`} aria-live="polite" role={state.ok ? "status" : "alert"}>
          {state.ok ? "Discount added." : state.message}
        </p>
      ) : null}
    </form>
  );
}
