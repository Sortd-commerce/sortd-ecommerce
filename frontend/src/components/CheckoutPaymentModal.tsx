"use client";

import { X } from "@phosphor-icons/react";
import { StripePaymentForm } from "@/components/StripePaymentForm";

export function CheckoutPaymentModal({
  clientSecret,
  preferWallet,
  total,
  onSuccess,
  onClose,
  onProcessingChange,
  locked = false,
}: {
  clientSecret: string;
  preferWallet: "apple_pay" | "card";
  total: string;
  onSuccess: (paymentIntentId: string) => void;
  onClose: () => void;
  onProcessingChange?: (processing: boolean) => void;
  locked?: boolean;
}) {
  return (
    <div className="checkout-pay-layer">
      <button
        type="button"
        className="checkout-pay-scrim"
        aria-label="Close payment"
        disabled={locked}
        onClick={() => {
          if (!locked) onClose();
        }}
      />
      <div className="checkout-pay-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-pay-title">
        <button
          type="button"
          className="checkout-pay-close"
          aria-label="Close"
          disabled={locked}
          onClick={() => {
            if (!locked) onClose();
          }}
        >
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
          onProcessingChange={onProcessingChange}
        />
      </div>
    </div>
  );
}
