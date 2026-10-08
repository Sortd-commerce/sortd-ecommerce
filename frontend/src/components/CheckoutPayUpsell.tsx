"use client";

import { ProductCard } from "@/components/ProductCard";
import type { CardProduct } from "@/components/catalog";
import { useCart } from "@/components/CartProvider";

export function CheckoutPayUpsell({ products }: { products: CardProduct[] }) {
  const { items } = useCart();
  const inCart = new Set(items.map((item) => item.variant_id));
  const suggestions = products.filter(
    (product) => product.default_variant && !inCart.has(product.default_variant.id),
  );

  if (!suggestions.length) return null;

  return (
    <section className="checkout-pay-upsell" aria-label="Add more items">
      <h2>Missed something?</h2>
      <div className="checkout-pay-upsell-rail">
        {suggestions.slice(0, 12).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
