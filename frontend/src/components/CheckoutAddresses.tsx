import { CheckoutAddressSection } from "@/components/CheckoutAddressSection";
import { apiFetch } from "@/lib/api";
import type { CheckoutAddress } from "@/lib/checkout";

export async function CheckoutAddressesLoader() {
  const addresses = await apiFetch<CheckoutAddress[]>("/addresses");
  const rows: CheckoutAddress[] = addresses.ok ? addresses.data || [] : [];
  return <CheckoutAddressSection addresses={rows} />;
}
