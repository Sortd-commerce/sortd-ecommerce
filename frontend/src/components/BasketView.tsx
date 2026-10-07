"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import { BasketClockIcon } from "@/components/HeaderIcons";
import { OptimizedImage } from "@/components/OptimizedImage";
import { OrderSummary } from "@/components/OrderSummary";
import { usePricing } from "@/components/PricingProvider";
import { useCart } from "@/components/CartProvider";
import { QuantityStepper } from "@/components/QuantityStepper";
import { useToast } from "@/components/Toast";
import { fetchDefaultAddressAction } from "@/lib/actions";
import { normalizeDeliveryPromise } from "@/lib/pricing";

function money(value: string | number) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

export function BasketView({
  variant = "drawer",
  onClose,
  signedIn = false,
}: {
  variant?: "drawer" | "page";
  onClose?: () => void;
  signedIn?: boolean;
}) {
  const { items, count, setQuantity, removeItem } = useCart();
  const { quote, rules } = usePricing();
  const deliveryPromise = normalizeDeliveryPromise(rules?.delivery_promise);
  const toast = useToast();
  const [deliverTo, setDeliverTo] = useState<string | null>(null);
  const remaining = Number(quote.amount_until_free_delivery);
  const minimum = Number(quote.free_delivery_minimum);
  const progress =
    minimum > 0 ? Math.min(100, Math.max(0, ((minimum - remaining) / minimum) * 100)) : 100;

  useEffect(() => {
    if (!signedIn) {
      setDeliverTo(null);
      return;
    }
    void fetchDefaultAddressAction().then((result) => {
      setDeliverTo(result.ok ? result.deliverTo || null : null);
    });
  }, [signedIn]);

  return (
    <div className={`basket-view basket-${variant}`}>
      <header className="basket-head">
        <div>
          <p className="basket-kicker">
            {count} {count === 1 ? "ITEM" : "ITEMS"}
          </p>
          <h2>Your basket</h2>
        </div>
        {onClose ? (
          <button type="button" className="basket-close" onClick={onClose} aria-label="Close basket">
            <X size={18} weight="bold" />
          </button>
        ) : null}
      </header>

      <div className="basket-deliver">
        <span className="basket-deliver-icon" aria-hidden>
          <BasketClockIcon />
        </span>
        <p>
          {deliveryPromise ? <strong>{deliveryPromise}</strong> : null}
          <span>{deliverTo ? `To ${deliverTo}` : "Across Dubai"}</span>
        </p>
      </div>

      {minimum > 0 && remaining > 0 && items.length ? (
        <div className="delivery-progress">
          <p>Add AED {money(quote.amount_until_free_delivery)} more for free delivery</p>
          <div className="delivery-progress-bar" aria-hidden>
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      <div className="basket-lines">
        {items.map((item) => {
          const max = item.on_hand;
          return (
            <article key={item.variant_id} className="basket-line">
              <div className="basket-thumb">
                {item.image_url ? (
                  <OptimizedImage
                    src={item.image_url}
                    alt=""
                    fill
                    sizes="54px"
                    className="object-contain"
                  />
                ) : (
                  <span>{item.title.slice(0, 1)}</span>
                )}
              </div>
              <div className="basket-copy">
                {item.brand ? <p className="basket-brand">{item.brand}</p> : null}
                {item.slug ? (
                  <Link href={`/products/${item.slug}`} onClick={onClose}>
                    {item.title}
                  </Link>
                ) : (
                  <p>{item.title}</p>
                )}
                {item.detail ? <small>{item.detail}</small> : null}
              </div>
              <div className="basket-line-side">
                <p className="basket-price">
                  <span className="basket-price-currency">AED</span>{" "}
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
            </article>
          );
        })}
        {!items.length ? (
          <div className="basket-empty">
            <p>Your basket is empty.</p>
            <Link href="/" className="btn btn-primary" onClick={onClose}>
              Browse products
            </Link>
          </div>
        ) : null}
      </div>

      {items.length ? (
        <>
          <OrderSummary className="basket-bill-wrap" variant="basket" />
          <div className="basket-foot">
            <Link href="/checkout" className="btn btn-primary basket-checkout" onClick={onClose}>
              <span>
                <strong>AED {money(quote.total)}</strong>
                <small>
                  TOTAL · {count} {count === 1 ? "ITEM" : "ITEMS"}
                </small>
              </span>
              <span>Checkout →</span>
            </Link>
            <p>Every item here passed all four gates.</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
