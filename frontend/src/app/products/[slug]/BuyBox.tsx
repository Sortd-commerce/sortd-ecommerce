"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { OptimizedImage } from "@/components/OptimizedImage";
import { QuantityStepper } from "@/components/QuantityStepper";

type Offer = {
  id: number;
  sku: string;
  title: string;
  price: string;
  compare_at_price: string | null;
  unit_count: number;
  max_order: number | null;
  on_hand: number;
  is_active: boolean;
};

type Flavor = { title: string; slug: string; image?: string };
type FlavorOption = { title: string; slug: string; image: string };

function unitPrice(price: string, unitCount: number) {
  const amount = Number.parseFloat(price);
  if (!Number.isFinite(amount) || unitCount < 2) return null;
  return (amount / unitCount).toFixed(2);
}

function formatPack(title: string) {
  return title.replace(/\s+x\s+/gi, " × ");
}

export function BuyBox({
  title,
  brand,
  flavorLabel,
  description,
  currentSlug,
  imageUrl,
  variants,
  flavors,
  highlights,
  hasLabReport,
}: {
  title: string;
  brand: string;
  flavorLabel: string;
  description: string;
  currentSlug: string;
  imageUrl?: string;
  variants: Offer[];
  flavors: Flavor[];
  highlights: Array<{ value: string; label: string }>;
  hasLabReport: boolean;
}) {
  const offers = variants.filter((row) => row.is_active);
  const [variantId, setVariantId] = useState(offers[0]?.id);
  const [addQty, setAddQty] = useState(1);
  const selected = useMemo(() => offers.find((row) => row.id === variantId) || offers[0], [offers, variantId]);
  const inStock = (selected?.on_hand || 0) > 0;
  const perUnit = selected ? unitPrice(selected.price, selected.unit_count) : null;
  const maxOrder =
    selected?.max_order != null && selected.max_order > 0
      ? Math.min(selected.max_order, selected.on_hand)
      : selected?.on_hand;

  const flavorOptions = useMemo(() => {
    const options: FlavorOption[] = [{ title: flavorLabel, slug: currentSlug, image: imageUrl || "" }];
    for (const flavor of flavors) {
      if (flavor.slug !== currentSlug) {
        options.push({ title: flavor.title, slug: flavor.slug, image: flavor.image || "" });
      }
    }
    return options;
  }, [currentSlug, flavorLabel, flavors, imageUrl]);

  return (
    <div className="buy-box">
      <div className="buy-title-block">
        <p className="buy-brand">{brand}</p>
        <h1>{title}</h1>
        {selected?.title ? <p className="buy-pack">{formatPack(selected.title)}</p> : null}
      </div>

      <div className="buy-price-row">
        <p className="buy-price">
          AED {selected?.price || "—"}
          {selected?.compare_at_price ? <s>AED {selected.compare_at_price}</s> : null}
        </p>
        {perUnit ? <p className="buy-unit-price">AED {perUnit} / bar</p> : null}
      </div>

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

      {flavorOptions.length ? (
        <div className="flavor-row">
          <p className="flavor-label">
            <span>Flavour</span> <strong>{flavorLabel}</strong>
          </p>
          <div className="flavor-thumbs">
            {flavorOptions.map((flavor) => (
              <Link
                key={flavor.slug}
                href={`/products/${flavor.slug}`}
                className={flavor.slug === currentSlug ? "flavor-thumb flavor-thumb--active" : "flavor-thumb"}
                aria-label={flavor.title}
                aria-current={flavor.slug === currentSlug ? "page" : undefined}
              >
                {flavor.image ? (
                  <OptimizedImage
                    src={flavor.image}
                    alt=""
                    width={64}
                    height={64}
                    sizes="64px"
                    className="flavor-thumb__img"
                  />
                ) : (
                  <span className="flavor-thumb__fallback">{flavor.title.slice(0, 1)}</span>
                )}
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
        <div className="buy-actions-row">
          <QuantityStepper
            value={addQty}
            max={maxOrder}
            min={1}
            disabled={!inStock}
            variant="buy"
            onChange={setAddQty}
          />
          {selected ? (
            <AddToCartButton
              variantId={selected.id}
              title={title}
              sku={selected.sku}
              unitPrice={selected.price}
              slug={currentSlug}
              onHand={selected.on_hand}
              maxOrder={selected.max_order}
              imageUrl={imageUrl}
              detail={selected.title}
              addQuantity={addQty}
              className="buy-actions-btn"
            />
          ) : (
            <button type="button" className="btn btn-primary buy-actions-btn" disabled>
              Unavailable
            </button>
          )}
        </div>
      </div>

      {description || !inStock || hasLabReport ? (
        <div className="buy-footnote">
          {description ? <p className="buy-copy">{description}</p> : null}
          {!inStock || hasLabReport ? (
            <p className="buy-meta">
              {!inStock ? "Out of stock" : `${selected?.on_hand} in stock`}
              {hasLabReport ? " · Lab report on file" : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
