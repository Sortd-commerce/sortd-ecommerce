"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AddToCartButton } from "@/app/products/[slug]/AddToCartButton";

type Offer = {
  id: number;
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

  return (
    <div className="card-quiet rounded-xl p-6">
      {flavors.length ? (
        <div className="mb-5">
          <p className="text-sm font-medium text-forest">Flavours</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-forest px-3 py-1 text-sm text-white">This one</span>
            {flavors.map((flavor) => (
              <Link
                key={flavor.slug}
                href={`/products/${flavor.slug}`}
                className="rounded-full border border-line px-3 py-1 text-sm text-ink/80 hover:border-forest"
              >
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
              className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 ${
                selected?.id === offer.id ? "border-forest bg-paper" : "border-line"
              }`}
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

      <p className="mt-2 text-sm text-ink/60">{selected ? `${selected.on_hand} in stock` : "Unavailable"}</p>
      {selected ? <AddToCartButton variantId={selected.id} /> : null}
    </div>
  );
}
