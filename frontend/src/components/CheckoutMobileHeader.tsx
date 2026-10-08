"use client";

import Link from "next/link";
import { ArrowLeft, CaretDown } from "@phosphor-icons/react";
import { useCheckoutSelection } from "@/components/CheckoutSelectionContext";
import { usePricing } from "@/components/PricingProvider";

export type CheckoutStep = "basket" | "delivery" | "pay";

function money(value: string | number) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

function addressLabel(address: { is_default?: boolean; line1: string; city: string }) {
  return address.is_default ? "Home" : address.line1 || address.city || "Address";
}

export function CheckoutMobileHeader({
  step,
  onBack,
}: {
  step: CheckoutStep;
  onBack?: () => void;
}) {
  const { quote } = usePricing();
  const { selectedAddress } = useCheckoutSelection();
  const savings = Number(quote.discount_amount);
  const addressText =
    selectedAddress?.formatted_address ||
    (selectedAddress ? `${selectedAddress.line1}, ${selectedAddress.city}` : "Add your delivery address");

  return (
    <header className="checkout-mobile-header">
      <div className="checkout-mobile-top">
        {onBack ? (
          <button type="button" className="checkout-back-btn" aria-label="Go back" onClick={onBack}>
            <ArrowLeft size={18} weight="bold" />
          </button>
        ) : (
          <Link href="/" className="checkout-back-btn" aria-label="Back to shop">
            <ArrowLeft size={18} weight="bold" />
          </Link>
        )}
        <div className="checkout-mobile-dest">
          <p>
            Deliver to {selectedAddress ? addressLabel(selectedAddress) : "Home"}
            <CaretDown size={12} weight="bold" aria-hidden />
          </p>
          <small>{addressText}</small>
        </div>
      </div>

      <nav className="checkout-stepper" aria-label="Checkout progress">
        <span className={step === "basket" ? "checkout-stepper-on" : ""} aria-current={step === "basket" ? "step" : undefined}>
          1 BASKET
        </span>
        <span className={step === "delivery" ? "checkout-stepper-on" : ""} aria-current={step === "delivery" ? "step" : undefined}>
          2 DELIVERY
        </span>
        <span className={step === "pay" ? "checkout-stepper-on" : ""} aria-current={step === "pay" ? "step" : undefined}>
          3 PAY
        </span>
      </nav>

      {savings > 0 ? (
        <p className="checkout-savings-banner">
          You&apos;re saving <strong>AED {money(savings)}</strong> on this order
        </p>
      ) : null}
    </header>
  );
}
