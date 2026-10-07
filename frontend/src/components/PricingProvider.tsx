"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { fetchPricingRulesAction, previewCouponsAction, quoteCartAction } from "@/lib/actions";
import {
  buildLocalQuote,
  EMPTY_QUOTE,
  type CouponOffer,
  type PriceQuote,
  type PricingRules,
} from "@/lib/pricing";

type PricingContextValue = {
  rules: PricingRules | null;
  quote: PriceQuote;
  coupons: CouponOffer[];
  couponPreviews: CouponOffer[];
  draftCode: string;
  appliedCode: string;
  couponError: string;
  setDraftCode: (value: string) => void;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => void;
  discountCode: string;
  setDiscountCode: (value: string) => void;
  refreshQuote: () => Promise<void>;
};

const PricingContext = createContext<PricingContextValue | null>(null);

export function PricingProvider({
  children,
  initialRules = null,
}: {
  children: React.ReactNode;
  initialRules?: PricingRules | null;
}) {
  const { items } = useCart();
  const [rules, setRules] = useState<PricingRules | null>(initialRules);
  const [quote, setQuote] = useState<PriceQuote>(EMPTY_QUOTE);
  const [draftCode, setDraftCodeState] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponPreviews, setCouponPreviews] = useState<CouponOffer[]>([]);
  const appliedRef = useRef(appliedCode);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    appliedRef.current = appliedCode;
  }, [appliedCode]);

  useEffect(() => {
    if (initialRules) return;
    void fetchPricingRulesAction().then((result) => {
      if (result.ok && result.data) setRules(result.data);
    });
  }, [initialRules]);

  const refreshQuote = useCallback(async () => {
    if (!items.length) {
      setQuote(EMPTY_QUOTE);
      return;
    }
    setQuote(buildLocalQuote(items, rules));
    try {
      const result = await quoteCartAction(
        items.map((item) => ({ variant_id: item.variant_id, quantity: item.quantity })),
        appliedRef.current,
      );
      if (result.ok && result.data) {
        setQuote(result.data);
      }
    } catch {
      setQuote(buildLocalQuote(items, rules));
    }
  }, [items, rules]);

  useEffect(() => {
    if (!items.length) {
      setQuote(EMPTY_QUOTE);
      return;
    }
    setQuote(buildLocalQuote(items, rules));
  }, [items, rules]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void refreshQuote();
    }, 180);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [items, appliedCode, refreshQuote]);

  useEffect(() => {
    if (!items.length) {
      setCouponPreviews([]);
      return;
    }
    void previewCouponsAction(items.map((item) => ({ variant_id: item.variant_id, quantity: item.quantity }))).then(
      (result) => {
        if (result.ok && result.data) setCouponPreviews(result.data);
      },
    );
  }, [items]);

  const setDraftCode = useCallback((value: string) => {
    setDraftCodeState(value.toUpperCase());
    if (couponError) setCouponError("");
  }, [couponError]);

  const applyCoupon = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed || !items.length) return false;
      const result = await quoteCartAction(
        items.map((item) => ({ variant_id: item.variant_id, quantity: item.quantity })),
        trimmed,
      );
      if (!result.ok || !result.data) {
        setCouponError(result.message || "That discount code is not valid.");
        return false;
      }
      if (Number(result.data.discount_amount) <= 0) {
        setCouponError("This code does not apply to your basket.");
        return false;
      }
      setAppliedCode(trimmed);
      setDraftCodeState(trimmed);
      setCouponError("");
      setQuote(result.data);
      return true;
    },
    [items],
  );

  const removeCoupon = useCallback(() => {
    setAppliedCode("");
    setDraftCodeState("");
    setCouponError("");
  }, []);

  const value = useMemo(
    () => ({
      rules,
      quote,
      coupons: rules?.coupons ?? [],
      couponPreviews,
      draftCode,
      appliedCode,
      couponError,
      setDraftCode,
      applyCoupon,
      removeCoupon,
      discountCode: appliedCode,
      setDiscountCode: setDraftCode,
      refreshQuote,
    }),
    [
      rules,
      quote,
      couponPreviews,
      draftCode,
      appliedCode,
      couponError,
      setDraftCode,
      applyCoupon,
      removeCoupon,
      refreshQuote,
    ],
  );

  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>;
}

export function usePricing() {
  const ctx = useContext(PricingContext);
  if (!ctx) throw new Error("usePricing must be used within PricingProvider");
  return ctx;
}
