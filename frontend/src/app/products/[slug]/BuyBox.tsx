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

type Flavor = { title: string; slug: string; image?: string };

export function BuyBox({
  title,
  category,
  description,
  currentSlug,
  imageUrl,
  variants,
  flavors,
  highlights,
  hasPassedReport,
}: {
  title: string;
  category: string;
  description: string;
  currentSlug: string;
  imageUrl?: string;
  variants: Offer[];
  flavors: Flavor[];
  highlights: Array<{ value: string; label: string }>;
  hasPassedReport: boolean;
}) {
  const offers = variants.filter((row) => row.is_active);
  const [variantId, setVariantId] = useState(offers[0]?.id);
  const selected = useMemo(() => offers.find((row) => row.id === variantId) || offers[0], [offers, variantId]);
  const inStock = (selected?.on_hand || 0) > 0;

  return (
    <div className="buy-box">
      <p className="buy-brand">{category}</p>
      <h1>{title}</h1>
      <p className="buy-price">
        <span>AED</span>
        {selected?.price || "—"}
        {selected?.compare_at_price ? <s>AED {selected.compare_at_price}</s> : null}
      </p>
      {selected?.title ? <p className="buy-pack">{selected.title}</p> : null}
      <p className="buy-meta">
        {inStock ? `${selected?.on_hand} in stock` : "Out of stock"}
        {hasPassedReport ? " · Lab report on file" : ""}
      </p>
      {description ? <p className="buy-copy">{description}</p> : null}

      {highlights.length ? (
        <div className="stat-row">
          {highlights.map((item) => (
            <div key={item.label} className="stat-box">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {flavors.length ? (
        <div className="flavor-row">
          <p>Flavour</p>
          <div>
            <span className="flavor-current">{title}</span>
            {flavors.map((flavor) => (
              <Link key={flavor.slug} href={`/products/${flavor.slug}`} className="flavor-link">
                {flavor.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={flavor.image} alt="" />
                ) : null}
                {flavor.title}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {offers.length > 1 ? (
        <div className="pack-row">
          <p>Pack</p>
          {offers.map((offer) => (
            <label key={offer.id} className={`pick-card ${selected?.id === offer.id ? "pick-card-on" : ""}`}>
              <input
                type="radio"
                name={`offer-${currentSlug}`}
                checked={selected?.id === offer.id}
                onChange={() => setVariantId(offer.id)}
              />
              <span>
                <strong>{offer.title}</strong>
                {offer.unit_count > 1 ? <small>{offer.unit_count} units</small> : null}
              </span>
              <b>
                <span>AED</span> {offer.price}
              </b>
            </label>
          ))}
        </div>
      ) : null}

      <div className="buy-actions">
        {selected ? (
          <AddToCartButton
            variantId={selected.id}
            title={title}
            sku={selected.sku}
            unitPrice={selected.price}
            slug={currentSlug}
            onHand={selected.on_hand}
            imageUrl={imageUrl}
            detail={selected.title}
          />
        ) : (
          <button type="button" className="btn btn-primary mt-6 w-full" disabled>
            Unavailable
          </button>
        )}
      </div>
    </div>
  );
}
