"use client";

import { useBasket } from "@/components/BasketProvider";
import { useCart } from "@/components/CartProvider";

function CartBagIcon() {
  return (
    <svg width="18" height="19" viewBox="0 0 18 19" fill="none" aria-hidden="true" className="cart-pill-icon">
      <path
        d="M4.7998 5.33333C4.7998 2.84 6.53314 0.799999 8.7998 0.799999C11.0665 0.799999 12.7998 2.84 12.7998 5.33333M0.799805 5.33333H16.7998L15.4665 17.8H2.13314L0.799805 5.33333Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function money(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

export function CartLink() {
  const { count, subtotal } = useCart();
  const { openBasket } = useBasket();
  const displayAmount = count ? subtotal : "0.00";
  const label = count ? `Basket, ${count} items, AED ${money(displayAmount)}` : "Basket";

  return (
    <button
      type="button"
      className="cart-pill"
      aria-label={label}
      aria-haspopup="dialog"
      onClick={openBasket}
    >
      <CartBagIcon />
      <span className="cart-pill-copy">
        <span className="cart-pill-count">
          {count} {count === 1 ? "ITEM" : "ITEMS"}
        </span>
        <span className="cart-pill-total">AED {money(displayAmount)}</span>
      </span>
    </button>
  );
}
