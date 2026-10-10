import { unstable_cache } from "next/cache";
import { apiFetch } from "@/lib/api";

export type CheckoutSlot = {
  date: string;
  start_time: string;
  end_time: string;
  remaining: number;
  window_id: number;
  source: string;
  status: "available" | "passed" | "full";
};

export type CheckoutPaymentMethod = {
  code: string;
  name: string;
  is_active: boolean;
};

export type CheckoutAddress = {
  id: number;
  line1: string;
  city: string;
  formatted_address: string;
  is_default?: boolean;
  place_id?: string;
  latitude?: string | null;
  longitude?: string | null;
  postal_code?: string;
  label?: string;
  community?: string;
  building?: string;
  unit?: string;
  floor?: string;
};

export const fetchCheckoutWindows = unstable_cache(
  async () => apiFetch<CheckoutSlot[]>("/delivery/windows", { auth: false, revalidate: 120 }),
  ["checkout-delivery-windows"],
  { revalidate: 120 },
);

export function fetchCheckoutPaymentMethods() {
  return apiFetch<CheckoutPaymentMethod[]>("/payments/methods", { auth: false, revalidate: 120 });
}
