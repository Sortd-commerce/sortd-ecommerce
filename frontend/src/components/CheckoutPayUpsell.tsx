"use client";

import { ProductCard } from "@/components/ProductCard";
import type { CardProduct } from "@/components/catalog";

function UpsellCardSkeleton() {
  return <div className="skeleton skeleton--upsell-card" aria-hidden />;
}

export function CheckoutPayUpsellSkeleton() {
  return (
    <section className="checkout-pay-upsell" aria-busy="true" aria-label="Loading suggestions">
      <h2>Missed something?</h2>
      <div className="checkout-pay-upsell-rail checkout-pay-upsell-rail--skeleton">
        {Array.from({ length: 4 }).map((_, index) => (
          <UpsellCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}

export function CheckoutPayUpsell({ products }: { products: CardProduct[] }) {
  const suggestions = products.filter((product) => product.default_variant);

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
