"use client";

import { CouponField } from "@/components/CouponField";
import { usePricing } from "@/components/PricingProvider";

function money(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

export function OrderSummary({
  showPromo = false,
  variant = "default",
  className = "",
}: {
  showPromo?: boolean;
  variant?: "default" | "basket";
  className?: string;
}) {
  const { quote } = usePricing();
  const hasDiscount = Number(quote.discount_amount) > 0;
  const deliveryFree = Number(quote.delivery_fee) <= 0;
  const remaining = Number(quote.amount_until_free_delivery);
  const isBasket = variant === "basket";

  return (
    <div className={className}>
      {showPromo ? <CouponField /> : null}
      {isBasket ? <p className="basket-kicker basket-bill-label">Bill details</p> : null}
      <dl className={`order-bill${isBasket ? " order-bill--basket" : ""}`}>
        <div>
          <dt>Item total</dt>
          <dd>AED {money(quote.subtotal)}</dd>
        </div>
        {hasDiscount ? (
          <div className="order-discount">
            <dt>{quote.discount_code ? `Coupon · ${quote.discount_code}` : "Discount"}</dt>
            <dd>- AED {money(quote.discount_amount)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Delivery fee</dt>
          <dd className={deliveryFree ? "order-fee-free" : undefined}>
            {deliveryFree ? "Free" : `AED ${money(quote.delivery_fee)}`}
          </dd>
        </div>
        <div className="order-due">
          <dt>To pay</dt>
          <dd>AED {money(quote.total)}</dd>
        </div>
      </dl>
      {!isBasket && remaining > 0 ? (
        <p className="delivery-note-line delivery-note-banner">
          Add AED {money(quote.amount_until_free_delivery)} more and delivery is free.
        </p>
      ) : !isBasket && Number(quote.free_delivery_minimum) > 0 && deliveryFree ? (
        <p className="delivery-note-line delivery-note-banner">Delivery is free on this order.</p>
      ) : null}
    </div>
  );
}
