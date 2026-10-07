"use client";

import { OpenBasketLink } from "@/components/OpenBasketLink";
import { AuthOpenButton } from "@/components/auth/AuthOpenButton";

export function CheckoutGuestGate() {
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
