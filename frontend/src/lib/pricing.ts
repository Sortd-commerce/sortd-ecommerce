export type PriceQuote = {
  subtotal: string;
  discount_amount: string;
  discount_code: string;
  discount_name: string;
  delivery_fee: string;
  configured_delivery_fee: string;
  free_delivery_minimum: string;
  amount_until_free_delivery: string;
  total: string;
};

export type PricingRules = {
  delivery_fee: string;
  free_delivery_minimum: string;
  delivery_promise: string;
  discounts: Array<{
    id: number;
    name: string;
    kind: string;
    value: string;
    scope: string;
    product_title: string;
  }>;
  coupons?: CouponOffer[];
};

export type CouponOffer = {
  code: string;
  name: string;
  kind: string;
  benefit: string;
  value: string;
  scope: string;
  headline: string;
  detail: string;
  minimum_order: string;
  max_discount: string;
  first_order_only: boolean;
  eligible?: boolean;
  ineligible_reason?: string;
  amount_needed?: string;
  estimated_savings?: string;
  is_best?: boolean;
};

const PRICING_RULES_KEY = "sortd_pricing_rules_v3";

export function normalizeDeliveryPromise(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  if (!text || text.toLowerCase() === "null") return null;
  return text;
}

export function loadCachedPricingRules(): PricingRules | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PRICING_RULES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PricingRules;
    if (!parsed || typeof parsed.delivery_fee !== "string") return null;
    return {
      ...parsed,
      delivery_promise: normalizeDeliveryPromise(parsed.delivery_promise) ?? "",
    };
  } catch {
    return null;
  }
}

export function saveCachedPricingRules(rules: PricingRules) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRICING_RULES_KEY, JSON.stringify(rules));
  } catch {
    // Ignore quota or privacy mode errors.
  }
}

export const EMPTY_QUOTE: PriceQuote = {
  subtotal: "0.00",
  discount_amount: "0.00",
  discount_code: "",
  discount_name: "",
  delivery_fee: "0.00",
  configured_delivery_fee: "0.00",
  free_delivery_minimum: "0.00",
  amount_until_free_delivery: "0.00",
  total: "0.00",
};

type QuoteLine = {
  unit_price: string;
  quantity: number;
};

function money(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

/** Mirrors backend `_delivery_charge` in commerce/pricing.py. */
export function computeDeliveryCharge(
  merchandise: number,
  configuredFee: number,
  minimum: number,
): { deliveryFee: number; amountUntilFree: number } {
  if (configuredFee <= 0 || minimum <= 0 || merchandise >= minimum) {
    return { deliveryFee: 0, amountUntilFree: 0 };
  }
  return { deliveryFee: configuredFee, amountUntilFree: Math.max(0, minimum - merchandise) };
}

/** Client-side estimate when the pricing API is unavailable or still loading. */
export function buildLocalQuote(items: QuoteLine[], rules: PricingRules | null): PriceQuote {
  if (!items.length) return EMPTY_QUOTE;

  const subtotalNum = items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);
  const configuredFee = Number(rules?.delivery_fee ?? 0);
  const minimum = Number(rules?.free_delivery_minimum ?? 0);
  const { deliveryFee, amountUntilFree } = computeDeliveryCharge(subtotalNum, configuredFee, minimum);
  const total = subtotalNum + deliveryFee;

  return {
    subtotal: money(subtotalNum),
    discount_amount: "0.00",
    discount_code: "",
    discount_name: "",
    delivery_fee: money(deliveryFee),
    configured_delivery_fee: money(configuredFee),
    free_delivery_minimum: money(minimum),
    amount_until_free_delivery: money(amountUntilFree),
    total: money(total),
  };
}
