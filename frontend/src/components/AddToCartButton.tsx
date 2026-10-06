"use client";

import { useEffect } from "react";
import { useBasket } from "@/components/BasketProvider";
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
  maxOrder,
  imageUrl,
  detail,
  addQuantity = 1,
  className = "",
}: {
  variantId: number;
  title: string;
  sku: string;
  unitPrice: string;
  slug?: string;
  onHand?: number;
  maxOrder?: number | null;
  imageUrl?: string;
  detail?: string;
  addQuantity?: number;
  className?: string;
}) {
  const { items, addItem, setQuantity, removeItem } = useCart();
  const { openBasket } = useBasket();
  const toast = useToast();
  const line = items.find((item) => item.variant_id === variantId);
  const inCart = line?.quantity || 0;
  const stock = onHand ?? line?.on_hand;
  const limit = maxOrder != null && maxOrder > 0 ? Math.min(maxOrder, stock ?? maxOrder) : stock;
  const outOfStock = stock != null && stock < 1;

  useEffect(() => {
    if (!line || onHand == null) return;
    if (line.on_hand === onHand && line.quantity <= onHand) return;
    setQuantity(variantId, Math.min(line.quantity, Math.max(0, onHand)), onHand);
  }, [line, onHand, setQuantity, variantId]);

  const buttonClass = `btn btn-primary buy-actions-btn ${className}`.trim();

  if (outOfStock && inCart < 1) {
    return (
      <button type="button" className={buttonClass} disabled>
        Out of stock
      </button>
    );
  }

  if (inCart > 0) {
    return (
      <div className={`buy-in-cart ${className}`.trim()}>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2">
          <span className="text-sm font-medium text-ink/70">In cart</span>
          <QuantityStepper
            value={inCart}
            max={limit}
            min={0}
            onChange={(next) => {
              if (next < 1) {
                removeItem(variantId);
                return;
              }
              if (limit != null && next > limit) {
                if (maxOrder != null && maxOrder > 0 && next > maxOrder) {
                  toast.error(`Max ${maxOrder} per order.`);
                  setQuantity(variantId, maxOrder, stock);
                  return;
                }
                toast.error(`Only ${stock} left in stock.`);
                setQuantity(variantId, stock ?? next, stock);
                return;
              }
              setQuantity(variantId, next, stock);
            }}
          />
        </div>
        <button type="button" className="btn btn-secondary w-full" onClick={openBasket}>
          View basket
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={buttonClass}
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
          quantity: Math.max(1, addQuantity),
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
      Add to basket
    </button>
  );
}
