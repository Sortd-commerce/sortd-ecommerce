"use client";

import { X } from "@phosphor-icons/react";
import { StripePaymentForm } from "@/components/StripePaymentForm";

export function CheckoutPaymentModal({
  clientSecret,
  preferWallet,
  total,
  onSuccess,
  onClose,
}: {
  clientSecret: string;
  preferWallet: "apple_pay" | "card";
  total: string;
  onSuccess: (paymentIntentId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="checkout-pay-layer">
      <button type="button" className="checkout-pay-scrim" aria-label="Close payment" onClick={onClose} />
      <div className="checkout-pay-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-pay-title">
        <button type="button" className="checkout-pay-close" aria-label="Close" onClick={onClose}>
          <X size={18} weight="bold" />
        </button>
        <p className="step-index">03</p>
        <h2 id="checkout-pay-title">Complete payment</h2>
        <p className="fine-print checkout-pay-total">
          Total due: <strong>AED {total}</strong>
        </p>
        <StripePaymentForm
          clientSecret={clientSecret}
          preferWallet={preferWallet}
          onSuccess={onSuccess}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
