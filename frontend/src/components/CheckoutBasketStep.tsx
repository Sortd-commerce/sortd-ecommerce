"use client";

import Link from "next/link";
import { CouponField } from "@/components/CouponField";
import { OptimizedImage } from "@/components/OptimizedImage";
import { OrderSummary } from "@/components/OrderSummary";
import { usePricing } from "@/components/PricingProvider";
import { useCart } from "@/components/CartProvider";
import { QuantityStepper } from "@/components/QuantityStepper";
import { useToast } from "@/components/Toast";
import { normalizeDeliveryPromise } from "@/lib/pricing";

function money(value: string | number) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

function uniqueProducts(items: ReturnType<typeof useCart>["items"]) {
  return new Set(items.map((item) => item.slug || item.title)).size;
}

export function CheckoutBasketStep({ onContinue }: { onContinue: () => void }) {
  const { items, count, setQuantity, removeItem } = useCart();
  const { quote, rules, couponPreviews } = usePricing();
  const toast = useToast();
  const deliveryPromise = normalizeDeliveryPromise(rules?.delivery_promise);
  const remaining = Number(quote.amount_until_free_delivery);
  const minimum = Number(quote.free_delivery_minimum);
  const progress =
    minimum > 0 ? Math.min(100, Math.max(0, ((minimum - remaining) / minimum) * 100)) : 100;
  const savings = Number(quote.discount_amount);
  const productCount = uniqueProducts(items);

  return (
    <div className="checkout-basket-step">
      <section className="checkout-panel checkout-panel--basket" aria-label="Basket">
        <div className="checkout-arrival-card">
          <h2>{deliveryPromise || "Arrives in about 30 min"}</h2>
          <p>
            {productCount} {productCount === 1 ? "product" : "products"} · {count}{" "}
            {count === 1 ? "item" : "items"} · or pick a slot next
          </p>
        </div>

        <ul className="checkout-basket-lines">
        {items.map((item) => {
          const max = item.on_hand;
          return (
            <li key={item.variant_id} className="checkout-basket-line">
              <div className="checkout-basket-thumb">
                {item.image_url ? (
                  <OptimizedImage src={item.image_url} alt="" fill sizes="58px" className="object-cover" />
                ) : (
                  <span>{item.title.slice(0, 1)}</span>
                )}
              </div>
              <div className="checkout-basket-copy">
                {item.brand ? <p className="checkout-basket-brand">{item.brand}</p> : null}
                {item.slug ? <Link href={`/products/${item.slug}`}>{item.title}</Link> : <p>{item.title}</p>}
                {item.detail ? <small>{item.detail}</small> : null}
              </div>
              <div className="checkout-basket-side">
                <p className="checkout-basket-price">
                  <span className="checkout-basket-price-currency">د.إ</span>{" "}
                  {money(Number(item.unit_price) * item.quantity)}
                </p>
                <QuantityStepper
                  value={item.quantity}
                  max={max}
                  min={0}
                  size="sm"
                  tone="inverse"
                  onChange={(next) => {
                    if (next < 1) {
                      removeItem(item.variant_id);
                      return;
                    }
                    if (max != null && next > max) {
                      toast.error(`Only ${max} left in stock.`);
                      setQuantity(item.variant_id, max, max);
                      return;
                    }
                    setQuantity(item.variant_id, next, max);
                  }}
                />
              </div>
            </li>
          );
        })}
        </ul>

        <p className="checkout-forgot">
          Forgot something?{" "}
          <Link href="/" className="checkout-forgot-link">
            Add more items
          </Link>
        </p>
      </section>

      {minimum > 0 && remaining > 0 ? (
        <div className="checkout-milestone">
          <p>Add د.إ {money(remaining)} more for free delivery</p>
          <div className="delivery-progress-bar" aria-hidden>
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="checkout-milestone-labels">
            <span>Free delivery at د.إ {money(minimum)}</span>
          </div>
        </div>
      ) : null}

      <section className="checkout-panel checkout-coupons">
        <h3>Coupons &amp; offers</h3>
        <CouponField />
        {couponPreviews.length ? (
          <button type="button" className="text-action checkout-coupons-all">
            View all coupons ›
          </button>
        ) : null}
      </section>

      <section className="checkout-panel checkout-bill-block">
        <h3>Bill summary</h3>
        <OrderSummary className="checkout-summary" />
      </section>

      {savings > 0 ? (
        <section className="checkout-savings-block">
          <div className="checkout-savings-head">
            <h3>Savings on this order</h3>
            <span className="checkout-savings-pill">د.إ {money(savings)}</span>
          </div>
          {quote.discount_code ? (
            <div className="checkout-savings-row">
              <span>Coupon {quote.discount_code}</span>
              <span>− د.إ {money(savings)}</span>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="checkout-sticky-foot">
        <div className="checkout-sticky-foot-row">
          <div className="checkout-sticky-total" aria-hidden>
            <small>TO PAY</small>
            <strong>د.إ {money(quote.total)}</strong>
          </div>
          <button type="button" className="btn btn-primary checkout-continue-btn" disabled={!items.length} onClick={onContinue}>
            <span className="checkout-continue-copy">
              Continue
              <small>Address &amp; delivery slot</small>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
