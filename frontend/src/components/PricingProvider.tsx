"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { fetchPricingRulesAction, quoteCartAction } from "@/lib/actions";
import { buildLocalQuote, EMPTY_QUOTE, type PriceQuote, type PricingRules } from "@/lib/pricing";

type PricingContextValue = {
  rules: PricingRules | null;
  quote: PriceQuote;
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
  const [discountCode, setDiscountCode] = useState("");
  const discountRef = useRef(discountCode);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    discountRef.current = discountCode;
  }, [discountCode]);

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
        discountRef.current,
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
