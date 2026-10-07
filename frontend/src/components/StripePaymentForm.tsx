"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useToast } from "@/components/Toast";

function PayForm({ orderNumber, onCancel }: { orderNumber: string; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function onPay(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setPending(true);
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (result.error) {
      toast.error(result.error.message || "Payment could not be completed.");
      setPending(false);
      return;
    }
    const confirmed = await fetch(`/api/orders/${orderNumber}/confirm-payment`, { method: "POST" }).then((response) =>
      response.json(),
    );
    if (!confirmed.ok) {
      toast.error(confirmed.message || "Payment is processing. Check your order in a moment.");
    } else {
      toast.success("Payment received.");
    }
    router.push(`/orders/${orderNumber}`);
  }

  return (
    <form onSubmit={onPay} className="stripe-pay-form">
      <p className="fine-print">Enter your card details to complete payment.</p>
      <PaymentElement />
      <div className="stripe-pay-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={pending}>
          Back
        </button>
        <button type="submit" className="btn btn-primary" disabled={!stripe || pending}>
          {pending ? "Processing…" : "Pay now"}
        </button>
      </div>
    </form>
  );
}

export function StripePaymentForm({
  clientSecret,
  orderNumber,
  onCancel,
}: {
  clientSecret: string;
  orderNumber: string;
  onCancel: () => void;
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
      <PayForm orderNumber={orderNumber} onCancel={onCancel} />
    </Elements>
  );
}
