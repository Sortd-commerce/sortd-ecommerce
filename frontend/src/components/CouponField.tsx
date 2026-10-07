"use client";

import { useMemo, useState } from "react";
import { Tag, Ticket } from "@phosphor-icons/react";
import { usePricing } from "@/components/PricingProvider";

function money(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

function offerDetail(offer: { kind: string; value: string; detail: string }) {
  if (offer.detail) return offer.detail;
  if (offer.kind === "percent") return `${Number(offer.value)}% off`;
  return `AED ${money(offer.value)} off`;
}

export function CouponField() {
  const {
    quote,
    couponPreviews,
    draftCode,
    setDraftCode,
    appliedCode,
    couponError,
    applyCoupon,
    removeCoupon,
  } = usePricing();
  const [showOffers, setShowOffers] = useState(false);
  const [applying, setApplying] = useState(false);

  const applied = Boolean(appliedCode && Number(quote.discount_amount) > 0);
  const typed = draftCode.trim().length > 0 && !applied;
  const saved = Number(quote.discount_amount) > 0;

  const offers = couponPreviews.length ? couponPreviews : [];
  const bestCode = useMemo(() => offers.find((row) => row.is_best)?.code || "", [offers]);

  async function onApply(code?: string) {
    const next = (code ?? draftCode).trim();
    if (!next) return;
    setApplying(true);
    await applyCoupon(next);
    setApplying(false);
    if (code) setDraftCode(code);
  }

  if (applied) {
    return (
      <div className="coupon-block">
        <div className="coupon-applied">
          <span className="coupon-applied-icon" aria-hidden>
            <Ticket size={18} weight="fill" />
          </span>
          <span className="coupon-applied-copy">
            <strong>{appliedCode}</strong>
            <small>
              {quote.discount_name || "Discount"} — applied
            </small>
          </span>
          <button type="button" className="coupon-remove" onClick={removeCoupon}>
            Remove
          </button>
        </div>
        {saved ? (
          <p className="coupon-saved">You saved AED {money(quote.discount_amount)} on this order.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="coupon-block">
      <label className="coupon-field">
        <span className="coupon-label">Coupon</span>
        <div className={`coupon-input-row ${couponError ? "coupon-input-row--error" : typed ? "coupon-input-row--typed" : ""}`}>
          <span className="coupon-input-icon" aria-hidden>
            <Tag size={16} weight="bold" />
          </span>
          <input
            name="discount_code"
            value={draftCode}
            onChange={(event) => setDraftCode(event.target.value)}
            placeholder="Enter coupon code"
            autoComplete="off"
            aria-invalid={Boolean(couponError)}
          />
          <button
            type="button"
            className="coupon-apply"
            disabled={!draftCode.trim() || applying}
            onClick={() => void onApply()}
          >
            {applying ? "…" : "Apply"}
          </button>
        </div>
      </label>

      {couponError ? (
        <p className="coupon-error">
          {couponError}
          {bestCode && !couponError.toLowerCase().includes(bestCode.toLowerCase())
            ? ` Try ${bestCode}.`
            : null}
        </p>
      ) : typed ? (
        <p className="coupon-hint">Press Apply to check the code.</p>
      ) : (
        <button type="button" className="coupon-offers-toggle" onClick={() => setShowOffers((open) => !open)}>
          {showOffers ? "Hide available offers" : "See available offers →"}
        </button>
      )}

      {showOffers && offers.length ? (
        <div className="coupon-offers">
          {offers.map((offer) => (
            <article
              key={offer.code}
              className={`coupon-offer ${offer.is_best ? "coupon-offer--best" : ""}`}
            >
              {offer.is_best ? <span className="coupon-offer-badge">Best for this order</span> : null}
              <p className="coupon-offer-code">{offer.code}</p>
              <h3>{offer.headline || offer.name}</h3>
              <p>{offer.detail || offerDetail(offer)}</p>
              <button
                type="button"
                className="coupon-offer-apply"
                disabled={offer.eligible === false}
                onClick={() => void onApply(offer.code)}
              >
                Apply
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
