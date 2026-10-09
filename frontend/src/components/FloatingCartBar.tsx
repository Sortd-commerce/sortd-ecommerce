"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useBasket } from "@/components/BasketProvider";
import { useCart } from "@/components/CartProvider";
import { useMobileViewport } from "@/lib/use-mobile-viewport";

function money(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

export function FloatingCartBar() {
  const pathname = usePathname();
  const { count, subtotal } = useCart();
  const { open, openBasket } = useBasket();
  const mobile = useMobileViewport();
  const onProductPage = pathname.startsWith("/products/");
  const visible = mobile && !pathname.startsWith("/checkout") && !onProductPage && count > 0 && !open;

  useEffect(() => {
    document.body.classList.toggle("has-floating-cart", visible);
    return () => document.body.classList.remove("has-floating-cart");
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="floating-cart-bar" aria-live="polite">
      <button type="button" className="floating-cart-bar-btn" onClick={openBasket} aria-haspopup="dialog">
        <span className="floating-cart-bar-left">
          <span className="floating-cart-bar-kicker">
            {count} {count === 1 ? "ITEM" : "ITEMS"}
          </span>
          <strong>AED {money(subtotal)}</strong>
        </span>
        <span className="floating-cart-bar-action">View basket →</span>
      </button>
    </div>
  );
}
