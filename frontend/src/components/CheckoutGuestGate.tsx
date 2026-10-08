"use client";

import { useEffect } from "react";
import { CheckoutBasketStep } from "@/components/CheckoutBasketStep";
import { CheckoutMobileHeader } from "@/components/CheckoutMobileHeader";
import { CheckoutSelectionProvider } from "@/components/CheckoutSelectionContext";
import { useAuth } from "@/components/auth/AuthProvider";

function CheckoutGuestGateInner() {
  const { openAuth } = useAuth();

  useEffect(() => {
    openAuth("login", "/checkout");
  }, [openAuth]);

  return (
    <div className="checkout-page checkout-page--mobile">
      <CheckoutMobileHeader step="basket" />
      <CheckoutBasketStep onContinue={() => openAuth("login", "/checkout")} />
    </div>
  );
}

export function CheckoutGuestGate() {
  return (
    <CheckoutSelectionProvider>
      <CheckoutGuestGateInner />
    </CheckoutSelectionProvider>
  );
}
