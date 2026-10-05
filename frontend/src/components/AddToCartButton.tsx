"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ShoppingCart } from "@phosphor-icons/react";
import { useCart } from "@/components/CartProvider";
import { QuantityStepper } from "@/components/QuantityStepper";
import { useToast } from "@/components/Toast";

export function AddToCartButton({
  variantId,
  title,
  sku,
  unitPrice,
  slug,
  onHand,
  imageUrl,
  detail,
  className = "",
}: {
  variantId: number;
  title: string;
  sku: string;
  unitPrice: string;
  slug?: string;
  onHand?: number;
  imageUrl?: string;
  detail?: string;
  className?: string;
}) {
  const { items, addItem, setQuantity, removeItem } = useCart();
  const toast = useToast();
  const line = items.find((item) => item.variant_id === variantId);
  const inCart = line?.quantity || 0;
  const stock = onHand ?? line?.on_hand;
  const outOfStock = stock != null && stock < 1;

  useEffect(() => {
    if (!line || onHand == null) return;
    if (line.on_hand === onHand && line.quantity <= onHand) return;
    setQuantity(variantId, Math.min(line.quantity, Math.max(0, onHand)), onHand);
  }, [line, onHand, setQuantity, variantId]);

  if (outOfStock && inCart < 1) {
    return (
      <button type="button" className={`btn btn-primary mt-6 w-full ${className}`} disabled>
        Out of stock
      </button>
    );
  }

  if (inCart > 0) {
    return (
      <div className={`mt-6 grid gap-3 ${className}`}>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2">
          <span className="text-sm font-medium text-ink/70">In cart</span>
          <QuantityStepper
            value={inCart}
            max={stock}
            min={0}
            onChange={(next) => {
              if (next < 1) {
                removeItem(variantId);
                return;
              }
              if (stock != null && next > stock) {
                toast.error(`Only ${stock} left in stock.`);
                setQuantity(variantId, stock, stock);
                return;
              }
              setQuantity(variantId, next, stock);
            }}
          />
        </div>
        <Link href="/cart" className="btn btn-secondary w-full">
          View basket
        </Link>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`btn btn-primary mt-6 w-full ${className}`}
      onClick={() => {
        const result = addItem({
          variant_id: variantId,
          title,
          sku,
          unit_price: unitPrice,
          slug,
          on_hand: stock,
          image_url: imageUrl,
          detail,
          quantity: 1,
        });
        if (!result.ok) {
          toast.error(result.message || "Could not add to cart.");
          return;
        }
        if (result.capped) {
          toast.error(result.message || "Stock limit reached.");
          return;
        }
        toast.success("Added to cart");
      }}
    >
      <ShoppingCart size={18} weight="bold" />
      Add to basket
    </button>
  );
}
