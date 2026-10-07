"use client";

import { useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useToast } from "@/components/Toast";

function PayForm({
  preferWallet,
  onSuccess,
  onCancel,
  onProcessingChange,
}: {
  preferWallet: "apple_pay" | "card";
  onSuccess: (paymentIntentId: string) => void;
  onCancel: () => void;
  onProcessingChange?: (processing: boolean) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function onPay(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setPending(true);
    onProcessingChange?.(true);
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (result.error) {
      toast.error(result.error.message || "Payment could not be completed.");
      setPending(false);
      onProcessingChange?.(false);
      return;
    }
    const paymentIntentId = result.paymentIntent?.id;
    if (!paymentIntentId) {
      toast.error("We couldn't confirm your payment. Please try again.");
      setPending(false);
      onProcessingChange?.(false);
      return;
    }
    onSuccess(paymentIntentId);
  }

  return (
    <form onSubmit={onPay} className="stripe-pay-form">
      <p className="fine-print">
        {preferWallet === "apple_pay"
          ? "Use Apple Pay, or enter your card details below."
          : "Enter your card details to pay."}
      </p>
      <PaymentElement options={{ wallets: { applePay: "auto", googlePay: "never" } }} />
      <div className="stripe-pay-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!stripe || pending}>
          {pending ? "Processing payment…" : "Pay now"}
        </button>
      </div>
    </form>
  );
}

export function StripePaymentForm({
  clientSecret,
  preferWallet = "card",
  onSuccess,
  onCancel,
  onProcessingChange,
}: {
  clientSecret: string;
  preferWallet?: "apple_pay" | "card";
  onSuccess: (paymentIntentId: string) => void;
  onCancel: () => void;
  onProcessingChange?: (processing: boolean) => void;
}) {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    void fetch("/api/payments/stripe/config")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.ok && payload.publishable_key) {
          setStripePromise(loadStripe(payload.publishable_key));
        }
      })
      .catch(() => undefined);
  }, []);

  if (!stripePromise) {
    return <p className="fine-print">Loading secure payment…</p>;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PayForm
        preferWallet={preferWallet}
        onSuccess={onSuccess}
        onCancel={onCancel}
        onProcessingChange={onProcessingChange}
      />
    </Elements>
  );
}
