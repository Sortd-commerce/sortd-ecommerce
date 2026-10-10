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
      <div className={`order-bill${isBasket ? " order-bill--basket" : ""}`}>
        <div className="order-bill-row">
          <span className="order-bill-label">Item total</span>
          <span className="order-bill-value">د.إ {money(quote.subtotal)}</span>
        </div>
        {hasDiscount ? (
          <div className="order-bill-row order-discount">
            <span className="order-bill-label">
              {quote.discount_code ? `Coupon · ${quote.discount_code}` : "Discount"}
            </span>
            <span className="order-bill-value">- د.إ {money(quote.discount_amount)}</span>
          </div>
        ) : null}
        <div className="order-bill-row">
          <span className="order-bill-label">Delivery fee</span>
          <span className={`order-bill-value${deliveryFree ? " order-fee-free" : ""}`}>
            {deliveryFree ? "Free" : `د.إ ${money(quote.delivery_fee)}`}
          </span>
        </div>
        <div className="order-bill-row order-due">
          <span className="order-bill-label">To pay</span>
          <span className="order-bill-value">د.إ {money(quote.total)}</span>
        </div>
      </div>
      {!isBasket && remaining > 0 ? (
        <p className="delivery-note-line delivery-note-banner">
          Add د.إ {money(quote.amount_until_free_delivery)} more and delivery is free.
        </p>
      ) : !isBasket && Number(quote.free_delivery_minimum) > 0 && deliveryFree ? (
        <p className="delivery-note-line delivery-note-banner">Delivery is free on this order.</p>
      ) : null}
    </div>
  );
}
