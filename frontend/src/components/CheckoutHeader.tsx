"use client";

import { Lock } from "@phosphor-icons/react";
import { BrandMark } from "@/components/BrandMark";
import { OpenBasketLink } from "@/components/OpenBasketLink";

export function CheckoutHeader() {
  return (
    <header className="checkout-top">
      <div className="header-inner checkout-top-row">
        <BrandMark size="sm" />
        <nav className="checkout-steps" aria-label="Checkout progress">
          <OpenBasketLink>Basket</OpenBasketLink>
          <span className="checkout-step-sep" aria-hidden>
            —
          </span>
          <span className="step-on" aria-current="step">
            Details
          </span>
          <span className="checkout-step-sep" aria-hidden>
            —
          </span>
          <a href="#pay">Pay</a>
        </nav>
        <p className="secure-note">
          <Lock size={14} weight="bold" aria-hidden />
          Secure checkout
        </p>
      </div>
    </header>
  );
}
