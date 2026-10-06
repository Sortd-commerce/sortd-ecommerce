"use client";

import { useEffect } from "react";
import { useCart } from "@/components/CartProvider";
import { markCartForClear } from "@/lib/cart-store";

export function OrderCartClear() {
  const { clearCart } = useCart();

  useEffect(() => {
    markCartForClear();
    clearCart();
  }, [clearCart]);

  return null;
}
