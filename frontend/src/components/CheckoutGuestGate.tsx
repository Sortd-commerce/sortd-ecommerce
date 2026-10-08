"use client";

import { useEffect } from "react";
import { CheckoutBasketStep } from "@/components/CheckoutBasketStep";
import { CheckoutMobileHeader } from "@/components/CheckoutMobileHeader";
import { CheckoutSelectionProvider } from "@/components/CheckoutSelectionContext";
import { OpenBasketLink } from "@/components/OpenBasketLink";
import { AuthOpenButton } from "@/components/auth/AuthOpenButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMobileViewport } from "@/lib/use-mobile-viewport";

function CheckoutGuestGateInner() {
  const { openAuth } = useAuth();
  const mobile = useMobileViewport();

  useEffect(() => {
    if (mobile) openAuth("login", "/checkout");
  }, [mobile, openAuth]);

  if (mobile) {
    return (
      <div className="checkout-page checkout-page--mobile">
        <CheckoutMobileHeader step="basket" />
        <CheckoutBasketStep onContinue={() => openAuth("login", "/checkout")} />
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <section className="checkout-guest">
        <p className="checkout-guest-kicker">Almost there</p>
        <h1>Sign in to checkout</h1>
        <p className="checkout-guest-copy">
          Sign in or create an account to add your delivery address and place your order.
        </p>
        <div className="checkout-guest-actions">
          <AuthOpenButton mode="login" next="/checkout" className="btn btn-primary">
            Sign in
          </AuthOpenButton>
          <AuthOpenButton mode="signup" next="/checkout" className="btn btn-secondary">
            Create account
          </AuthOpenButton>
        </div>
        <OpenBasketLink className="checkout-guest-basket">Review basket</OpenBasketLink>
      </section>
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
