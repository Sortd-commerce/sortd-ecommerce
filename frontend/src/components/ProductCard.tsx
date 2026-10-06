"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { QuantityStepper } from "@/components/QuantityStepper";
import { useToast } from "@/components/Toast";
import type { CardProduct } from "@/components/catalog";
import { cardTint } from "@/lib/tints";

export function ProductCard({ product }: { product: CardProduct }) {
  const { items, addItem, setQuantity, removeItem } = useCart();
  const toast = useToast();
  const variant = product.default_variant;
  const line = variant ? items.find((item) => item.variant_id === variant.id) : undefined;
  const qty = line?.quantity || 0;
  const stock = variant?.on_hand;
  const soldOut = stock != null && stock < 1 && qty < 1;
  const price = variant?.price || product.from_price;
  const tint = cardTint(product.id);

  return (
    <article className="product-card">
      <Link href={`/products/${product.slug}`} className="product-card-media" style={{ background: tint }}>
        {product.primary_image?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.primary_image.url} alt={product.primary_image.alt || product.title} />
        ) : (
          <span className="product-card-fallback">{product.category.name}</span>
        )}
      </Link>
      <div className="product-card-body">
        <p className="product-card-brand">{product.category.name}</p>
        <Link href={`/products/${product.slug}`} className="product-card-title">
          {product.title}
        </Link>
        {variant?.title ? <p className="product-card-detail">{variant.title}</p> : null}
        <div className="product-card-row">
          <p className="product-card-price">
            <span>AED</span>
            {price || "—"}
          </p>
          {variant && !soldOut ? (
            qty < 1 ? (
              <button
                type="button"
                className="product-add-btn"
                onClick={() => {
                  const result = addItem({
                    variant_id: variant.id,
                    title: product.title,
                    sku: variant.sku,
                    unit_price: variant.price,
                    slug: product.slug,
                    on_hand: stock,
                    image_url: product.primary_image?.url,
                    detail: variant.title,
                    quantity: 1,
                  });
                  if (!result.ok || result.capped) toast.error(result.message || "Could not add to basket.");
                }}
              >
                ADD
              </button>
            ) : (
              <QuantityStepper
                tone="inverse"
                size="sm"
                value={qty}
                min={0}
                max={stock}
                onChange={(next) => {
                  if (next < 1) {
                    removeItem(variant.id);
                    return;
                  }
                  if (stock != null && next > stock) {
                    toast.error(`Only ${stock} left in stock.`);
                    setQuantity(variant.id, stock, stock);
                    return;
                  }
                  setQuantity(variant.id, next, stock);
                }}
              />
            )
          ) : (
            <span className="sold-out">{soldOut ? "Sold out" : ""}</span>
          )}
        </div>
      </div>
    </article>
  );
}
