"use client";

import Link from "next/link";
import { ShoppingCart } from "@phosphor-icons/react";
import { useCart } from "@/components/CartProvider";

export function CartLink() {
  const { count } = useCart();
  return (
    <Link href="/cart" className="nav-link cart-link" aria-label={count ? `Cart, ${count} items` : "Cart"}>
      <ShoppingCart size={20} weight="bold" />
      <span>Cart</span>
      {count > 0 ? <span className="cart-badge">{count > 99 ? "99+" : count}</span> : null}
    </Link>
  );
}
