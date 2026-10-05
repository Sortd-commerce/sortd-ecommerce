import { apiFetch } from "@/lib/api";
import type { CartLine } from "@/lib/cart-store";

export type PriceQuote = {
  subtotal: string;
  discount_amount: string;
  discount_code: string;
  delivery_fee: string;
  configured_delivery_fee: string;
  free_delivery_minimum: string;
  amount_until_free_delivery: string;
  total: string;
};

export type PricingRules = {
  delivery_fee: string;
  free_delivery_minimum: string;
  discounts: Array<{
    id: number;
    name: string;
    kind: string;
    value: string;
    scope: string;
    product_title: string;
  }>;
};

export const EMPTY_QUOTE: PriceQuote = {
  subtotal: "0.00",
  discount_amount: "0.00",
  discount_code: "",
  delivery_fee: "0.00",
  configured_delivery_fee: "0.00",
  free_delivery_minimum: "0.00",
  amount_until_free_delivery: "0.00",
  total: "0.00",
};

export async function fetchPricingRules() {
  return apiFetch<PricingRules>("/pricing", { auth: false });
}

export async function quoteCart(items: CartLine[], discountCode?: string) {
  return apiFetch<PriceQuote>("/pricing/quote", {
    method: "POST",
    auth: false,
    body: {
      items: items.map((item) => ({ variant_id: item.variant_id, quantity: item.quantity })),
      discount_code: discountCode?.trim() || null,
    },
  });
}
