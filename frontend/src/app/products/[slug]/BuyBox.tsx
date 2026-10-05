"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AddToCartButton } from "@/components/AddToCartButton";

type Offer = {
  id: number;
  sku: string;
  title: string;
  price: string;
  compare_at_price: string | null;
  unit_count: number;
  on_hand: number;
  is_active: boolean;
};

type Flavor = { title: string; slug: string; kind: string };

export function BuyBox({
  currentSlug,
  variants,
  related,
}: {
  currentSlug: string;
  variants: Offer[];
  related: Flavor[];
}) {
  const offers = variants.filter((row) => row.is_active);
  const [variantId, setVariantId] = useState(offers[0]?.id);
  const selected = useMemo(() => offers.find((row) => row.id === variantId) || offers[0], [offers, variantId]);
  const flavors = related.filter((row) => row.kind === "flavor");
  const inStock = (selected?.on_hand || 0) > 0;

  return (
    <div className="buy-box card-quiet rounded-2xl p-6 md:sticky md:top-24">
      {flavors.length ? (
        <div className="mb-5">
          <p className="text-sm font-medium text-forest">Flavours</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="chip chip-active">This one</span>
            {flavors.map((flavor) => (
              <Link key={flavor.slug} href={`/products/${flavor.slug}`} className="chip chip-link">
                {flavor.title}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {offers.length > 1 ? (
        <div className="mb-5 grid gap-2">
          <p className="text-sm font-medium text-forest">Pack offer</p>
          {offers.map((offer) => (
            <label
              key={offer.id}
              className={`offer-row ${selected?.id === offer.id ? "offer-row-active" : ""}`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name={`offer-${currentSlug}`}
                  checked={selected?.id === offer.id}
                  onChange={() => setVariantId(offer.id)}
                />
                <span>
                  {offer.title}
                  {offer.unit_count > 1 ? <span className="block text-xs text-ink/55">{offer.unit_count} units</span> : null}
                </span>
              </span>
              <span className="text-right">
                <span className="font-semibold text-forest">AED {offer.price}</span>
                {offer.compare_at_price ? (
                  <span className="ml-2 text-xs text-ink/45 line-through">{offer.compare_at_price}</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <>
          <p className="text-sm text-ink/60">{selected?.title || "Variant"}</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-4xl text-forest">AED {selected?.price || "—"}</p>
        </>
      )}

      <p className={`mt-3 text-sm font-medium ${inStock ? "text-leaf" : "text-citrus"}`}>
        {selected ? (inStock ? `${selected.on_hand} in stock` : "Out of stock") : "Unavailable"}
      </p>

      {selected ? (
        <AddToCartButton
          variantId={selected.id}
          title={selected.title}
          sku={selected.sku}
          unitPrice={selected.price}
          slug={currentSlug}
          onHand={selected.on_hand}
        />
      ) : null}
    </div>
  );
}
