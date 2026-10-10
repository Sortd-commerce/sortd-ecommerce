"use client";

import Link from "next/link";
import { ArrowLeft, CaretDown } from "@phosphor-icons/react";
import { useCheckoutSelection } from "@/components/CheckoutSelectionContext";
import { usePricing } from "@/components/PricingProvider";
import { formatAddressDetails, formatAddressLabel } from "@/lib/address";

export type CheckoutStep = "basket" | "delivery" | "pay";

function money(value: string | number) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

function addressLabel(address: {
  is_default?: boolean;
  line1: string;
  city: string;
  label?: string;
  building?: string;
  unit?: string;
  floor?: string;
  community?: string;
  formatted_address?: string;
}) {
  return formatAddressLabel(address.label);
}

const STEP_ORDER: Record<CheckoutStep, number> = { basket: 0, delivery: 1, pay: 2 };

function stepClass(current: CheckoutStep, step: CheckoutStep) {
  if (current === step) return "checkout-stepper-on";
  if (STEP_ORDER[step] < STEP_ORDER[current]) return "checkout-stepper-done";
  return "";
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
  const addressText = selectedAddress
    ? formatAddressDetails(selectedAddress)
    : "Add your delivery address";

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
        <span className="checkout-top-spacer" aria-hidden />
      </div>

      <nav className="checkout-stepper" aria-label="Checkout progress">
        <span className={stepClass(step, "basket")} aria-current={step === "basket" ? "step" : undefined}>
          1 BASKET
        </span>
        <span className={stepClass(step, "delivery")} aria-current={step === "delivery" ? "step" : undefined}>
          2 DELIVERY
        </span>
        <span className={stepClass(step, "pay")} aria-current={step === "pay" ? "step" : undefined}>
          3 PAY
        </span>
      </nav>

      {savings > 0 ? (
        <p className="checkout-savings-banner">
          You&apos;re saving <strong>د.إ {money(savings)}</strong> on this order
        </p>
      ) : null}
    </header>
  );
}
