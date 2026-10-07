"use client";

import { loadStripe } from "@stripe/stripe-js";
import { useEffect, useState } from "react";

type WalletSupport = {
  applePay: boolean;
  loading: boolean;
};

function amountMinor(total: string) {
  const amount = Number(total);
  if (!Number.isFinite(amount) || amount <= 0) return 100;
  return Math.max(100, Math.round(amount * 100));
}

export function useStripeWalletSupport(total: string): WalletSupport {
  const [support, setSupport] = useState<WalletSupport>({
    applePay: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/payments/stripe/config");
        const payload = await response.json();
        if (!payload.ok || !payload.publishable_key) {
          if (!cancelled) setSupport({ applePay: false, loading: false });
          return;
        }

        const stripe = await loadStripe(payload.publishable_key);
        if (!stripe || cancelled) {
          if (!cancelled) setSupport({ applePay: false, loading: false });
          return;
        }

        const paymentRequest = stripe.paymentRequest({
          country: "AE",
          currency: "aed",
          total: { label: "Sortd order", amount: amountMinor(total) },
          requestPayerName: true,
          requestPayerEmail: true,
        });
        const result = await paymentRequest.canMakePayment();
        if (cancelled) return;
        setSupport({
          applePay: Boolean(result?.applePay),
          loading: false,
        });
      } catch {
        if (!cancelled) setSupport({ applePay: false, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [total]);

  return support;
}
