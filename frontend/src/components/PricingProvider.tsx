"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { EMPTY_QUOTE, fetchPricingRules, quoteCart, type PriceQuote, type PricingRules } from "@/lib/pricing";

type PricingContextValue = {
  rules: PricingRules | null;
  quote: PriceQuote;
  discountCode: string;
  setDiscountCode: (value: string) => void;
  refreshQuote: () => Promise<void>;
};

const PricingContext = createContext<PricingContextValue | null>(null);

export function PricingProvider({ children }: { children: React.ReactNode }) {
  const { items } = useCart();
  const [rules, setRules] = useState<PricingRules | null>(null);
  const [quote, setQuote] = useState<PriceQuote>(EMPTY_QUOTE);
  const [discountCode, setDiscountCode] = useState("");
  const discountRef = useRef(discountCode);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    discountRef.current = discountCode;
  }, [discountCode]);

  useEffect(() => {
    void fetchPricingRules().then((result) => {
      if (result.ok && result.data) setRules(result.data);
    });
  }, []);

  const refreshQuote = useCallback(async () => {
    if (!items.length) {
      setQuote(EMPTY_QUOTE);
      return;
    }
    const result = await quoteCart(items, discountRef.current);
    if (result.ok && result.data) setQuote(result.data);
  }, [items]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void refreshQuote();
    }, 180);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [items, discountCode, refreshQuote]);

  const value = useMemo(
    () => ({ rules, quote, discountCode, setDiscountCode, refreshQuote }),
    [rules, quote, discountCode, refreshQuote],
  );

  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>;
}

export function usePricing() {
  const ctx = useContext(PricingContext);
  if (!ctx) throw new Error("usePricing must be used within PricingProvider");
  return ctx;
}
