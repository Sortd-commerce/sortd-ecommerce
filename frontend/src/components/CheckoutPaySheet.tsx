"use client";

import type { CardProduct } from "@/components/catalog";
import { CheckoutPayUpsell, CheckoutPayUpsellSkeleton } from "@/components/CheckoutPayUpsell";
import { DirhamIcon } from "@/components/DirhamIcon";

function money(value: string | number) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

export function CheckoutPaySheet({
  upsellProducts,
  upsellLoading = false,
  total,
  canPlace,
  onPay,
  onDismiss,
  payPending = false,
}: {
  upsellProducts: CardProduct[];
  upsellLoading?: boolean;
  total: string;
  canPlace: boolean;
  onPay: () => void;
  onDismiss?: () => void;
  payPending?: boolean;
}) {
  const showUpsell = upsellProducts.length > 0;

  return (
    <div className="checkout-pay-step-shell">
      {onDismiss ? (
        <button type="button" className="checkout-pay-step-scrim" aria-label="Back to delivery" onClick={onDismiss} />
      ) : (
        <div className="checkout-pay-step-scrim" aria-hidden />
      )}
      <div className="checkout-pay-sheet" role="region" aria-label="Pay for order">
        <div className="checkout-pay-sheet-handle" aria-hidden />
        {upsellLoading || showUpsell ? (
          <div className="checkout-pay-sheet-scroll">
            {upsellLoading ? <CheckoutPayUpsellSkeleton /> : <CheckoutPayUpsell products={upsellProducts} />}
          </div>
        ) : null}
        <div className="checkout-pay-sheet-foot checkout-pay-sheet-foot--pay-only">
          <button
            type="button"
            className="btn btn-primary checkout-pay-btn"
            disabled={!canPlace || payPending}
            onClick={onPay}
          >
            {payPending ? "Redirecting to Stripe…" : <span>Pay <DirhamIcon /> {money(total)}</span>}
          </button>
          <p className="fine-print checkout-footnote checkout-footnote--sticky">
            Every item in this order passed all four gates.
          </p>
        </div>
      </div>
    </div>
  );
}
