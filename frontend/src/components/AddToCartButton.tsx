"use client";

import { useCart } from "@/components/CartProvider";

export function AddToCartButton({
  variantId,
  title,
  sku,
  unitPrice,
  slug,
}: {
  variantId: number;
  title: string;
  sku: string;
  unitPrice: string;
  slug?: string;
}) {
  const { addItem } = useCart();
  return (
    <button
      type="button"
      className="btn btn-primary mt-6 w-full"
      onClick={() => addItem({ variant_id: variantId, title, sku, unit_price: unitPrice, slug, quantity: 1 })}
    >
      Add to cart
    </button>
  );
}
