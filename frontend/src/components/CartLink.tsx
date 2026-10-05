"use client";

import { ShoppingBag } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useBasket } from "@/components/BasketProvider";
import { useCart } from "@/components/CartProvider";

export function CartLink() {
  const { count } = useCart();
  const { openBasket } = useBasket();
  const pathname = usePathname();
  const label = count ? `Basket, ${count} items` : "Basket";

  return (
    <button
      type="button"
      className="icon-cart"
      aria-label={label}
      aria-haspopup="dialog"
      onClick={() => {
        if (pathname === "/cart") return;
        openBasket();
      }}
    >
      <ShoppingBag size={22} weight="bold" />
      {count > 0 ? <span className="cart-badge">{count > 99 ? "99+" : count}</span> : null}
    </button>
  );
}
