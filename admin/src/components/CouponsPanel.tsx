"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "@phosphor-icons/react";
import { SubmitButton } from "@/components/ActionForm";
import { CouponFormFields } from "@/components/CouponFormFields";
import type { DiscountRow } from "@/components/DiscountEditor";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { createDiscountAction, removeDiscountAction, updateDiscountAction } from "@/lib/actions";
import { emptyActionState } from "@/lib/action-state";

type DrawerState =
  | { mode: "create" }
  | { mode: "edit"; coupon: DiscountRow };

function benefitLabel(value: string) {
  return value === "free_delivery" ? "Free delivery" : "Merchandise";
}

function CouponDrawer({
  drawer,
  onClose,
  onSaved,
}: {
  drawer: DrawerState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isCreate = drawer.mode === "create";
  const coupon = drawer.mode === "edit" ? drawer.coupon : undefined;

  return (
    <div className="drawer-layer">
      <button type="button" className="drawer-scrim" aria-label="Close coupon panel" onClick={onClose} />
      <aside
        className="drawer-panel drawer-panel--wide drawer-panel--enter"
        role="dialog"
        aria-modal="true"
        aria-label={isCreate ? "Add coupon" : `Edit ${coupon?.code}`}
      >
        <div className="drawer-head">
          <div>
            <h2 className="text-lg font-semibold">{isCreate ? "Add coupon" : coupon?.code}</h2>
            <p className="mt-1 text-sm text-muted">
              {isCreate
                ? "Promo codes appear at checkout under “See available offers”."
                : coupon?.headline || coupon?.name}
            </p>
          </div>
          <button type="button" className="drawer-close" aria-label="Close" onClick={onClose}>
            <X size={18} weight="bold" />
          </button>
        </div>
        <div className="drawer-body">
          {isCreate ? (
            <CreateCouponForm onSuccess={onSaved} />
          ) : coupon ? (
            <EditCouponForm key={coupon.id} coupon={coupon} onSuccess={onSaved} onDeleted={onSaved} />
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function CreateCouponForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, formAction] = useActionState(createDiscountAction, emptyActionState);

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state.ok, onSuccess]);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <CouponFormFields />
      <SubmitButton className="sm:col-span-2" pendingLabel="Adding…">
        Add coupon
      </SubmitButton>
      {state.message && !state.ok ? (
        <p className="text-sm text-warn sm:col-span-2" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function EditCouponForm({
  coupon,
  onSuccess,
  onDeleted,
}: {
  coupon: DiscountRow;
  onSuccess: () => void;
  onDeleted: () => void;
}) {
  const [state, formAction] = useActionState(updateDiscountAction, emptyActionState);
  const [deleteState, deleteAction] = useActionState(removeDiscountAction, emptyActionState);

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state.ok, onSuccess]);

  useEffect(() => {
    if (deleteState.ok) onDeleted();
  }, [deleteState.ok, onDeleted]);

  return (
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-3 sm:grid-cols-2">
        <CouponFormFields coupon={coupon} />
        <SubmitButton className="sm:col-span-2" pendingLabel="Saving…">
          Save coupon
        </SubmitButton>
        {state.message && !state.ok ? (
          <p className="text-sm text-warn sm:col-span-2" role="alert">
            {state.message}
          </p>
        ) : null}
      </form>
      <form action={deleteAction}>
        <input type="hidden" name="discount_id" value={coupon.id} />
        <input type="hidden" name="redirect_to" value="/coupons" />
        <SubmitButton className="btn-danger w-full" pendingLabel="Deleting…">
          Delete coupon
        </SubmitButton>
        {deleteState.message && !deleteState.ok ? (
          <p className="mt-2 text-sm text-warn" role="alert">
            {deleteState.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}

export function CouponsPanel({ coupons }: { coupons: DiscountRow[] }) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  const refreshAndClose = useCallback(() => {
    setDrawer(null);
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!drawer) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawer]);

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Promo codes shown at checkout under “See available offers”. Set headline, detail, minimum order, and caps to match each offer card."
        actions={
          <button type="button" className="btn" onClick={() => setDrawer({ mode: "create" })}>
            Add coupon
          </button>
        }
      />

      <div className="panel overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Offer</th>
              <th>Benefit</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((coupon) => (
              <tr key={coupon.id}>
                <td>
                  <p className="font-medium">{coupon.code}</p>
                  <p className="text-sm text-muted">{coupon.name}</p>
                </td>
                <td>
                  <p className="font-medium">{coupon.headline || coupon.name}</p>
                  {coupon.detail ? <p className="text-sm text-muted">{coupon.detail}</p> : null}
                </td>
                <td className="text-sm text-muted">{benefitLabel(coupon.benefit || "merchandise")}</td>
                <td>
                  <StatusBadge value={coupon.is_active ? "active" : "inactive"} />
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    className="btn-ghost text-sm"
                    onClick={() => setDrawer({ mode: "edit", coupon })}
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!coupons.length ? <p className="px-4 py-8 text-sm text-muted">No promo codes yet.</p> : null}
      </div>

      {drawer ? <CouponDrawer drawer={drawer} onClose={() => setDrawer(null)} onSaved={refreshAndClose} /> : null}
    </>
  );
}
