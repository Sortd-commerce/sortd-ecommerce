"use client";

import type { ReactNode } from "react";
import type { CardProduct } from "@/components/catalog";
import { CheckoutPayUpsell } from "@/components/CheckoutPayUpsell";

function money(value: string | number) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

export function CheckoutPaySheet({
  upsellProducts,
  total,
  canPlace,
  paysOnline,
  formId,
  onPay,
  children,
}: {
  upsellProducts: CardProduct[];
  total: string;
  canPlace: boolean;
  paysOnline: boolean;
  formId: string;
  onPay: () => void;
  children: ReactNode;
}) {
  const showUpsell = upsellProducts.length > 0;

  return (
    <div className="checkout-pay-step-shell">
      <div className="checkout-pay-step-scrim" aria-hidden />
      <div className="checkout-pay-sheet" role="region" aria-label="Pay for order">
        <div className="checkout-pay-sheet-handle" aria-hidden />
        {showUpsell ? (
          <div className="checkout-pay-sheet-scroll">
            <CheckoutPayUpsell products={upsellProducts} />
          </div>
        ) : null}
        <div className="checkout-pay-sheet-foot">
          <div className="checkout-pay-sheet-pay">{children}</div>
          {paysOnline ? (
            <button
              type="button"
              className="btn btn-primary checkout-pay-btn"
              disabled={!canPlace}
              onClick={onPay}
            >
              Pay AED {money(total)}
            </button>
          ) : (
            <button type="submit" form={formId} className="btn btn-primary checkout-pay-btn" disabled={!canPlace}>
              Pay AED {money(total)}
            </button>
          )}
          <p className="fine-print checkout-footnote checkout-footnote--sticky">
            Every item in this order passed all four gates.
          </p>
        </div>
      </div>
    </div>
  );
}
