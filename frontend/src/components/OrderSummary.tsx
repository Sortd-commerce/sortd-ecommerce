"use client";

import { usePricing } from "@/components/PricingProvider";

function money(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

export function OrderSummary({
  showPromo = false,
  className = "",
}: {
  showPromo?: boolean;
  className?: string;
}) {
  const { quote, discountCode, setDiscountCode } = usePricing();
  const hasDiscount = Number(quote.discount_amount) > 0;
  const deliveryFree = Number(quote.delivery_fee) <= 0;
  const remaining = Number(quote.amount_until_free_delivery);

  return (
    <div className={className}>
      {showPromo ? (
        <label className="field promo-field">
          <span>Promo code</span>
          <input
            name="discount_code"
            value={discountCode}
            onChange={(event) => setDiscountCode(event.target.value)}
            placeholder="Optional"
            autoComplete="off"
          />
        </label>
      ) : null}
      <dl className="order-bill">
        <div>
          <dt>Item total</dt>
          <dd>AED {money(quote.subtotal)}</dd>
        </div>
        {hasDiscount ? (
          <div>
            <dt>Discount</dt>
            <dd>- AED {money(quote.discount_amount)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Delivery fee</dt>
          <dd>{deliveryFree ? "Free" : `AED ${money(quote.delivery_fee)}`}</dd>
        </div>
        <div className="order-due">
          <dt>To pay</dt>
          <dd>AED {money(quote.total)}</dd>
        </div>
      </dl>
      {remaining > 0 ? (
        <p className="delivery-note-line delivery-note-banner">
          Add AED {money(quote.amount_until_free_delivery)} more and delivery is free.
        </p>
      ) : Number(quote.free_delivery_minimum) > 0 && deliveryFree ? (
        <p className="delivery-note-line delivery-note-banner">Delivery is free on this order.</p>
      ) : null}
    </div>
  );
}
