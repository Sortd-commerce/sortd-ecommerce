import { CheckoutForm } from "@/components/CheckoutForm";
import { CheckoutGuestGate } from "@/components/CheckoutGuestGate";
import { fetchCheckoutWindows, type CheckoutAddress } from "@/lib/checkout";
import { apiFetch } from "@/lib/api";
import { hasAuthSession } from "@/lib/auth";
import { fetchProductCatalog } from "@/lib/catalog";

export default async function CheckoutPage() {
  const signedIn = await hasAuthSession();
  if (!signedIn) {
    return <CheckoutGuestGate />;
  }

  const [windows, addresses, catalog] = await Promise.all([
    fetchCheckoutWindows(),
    apiFetch<CheckoutAddress[]>("/addresses"),
    fetchProductCatalog(),
  ]);

  const slots = windows.data || [];
  const savedAddresses = addresses.ok ? addresses.data || [] : [];

  return (
    <div className="checkout-page">
      <CheckoutForm
        slots={slots}
        addresses={savedAddresses}
        upsellProducts={catalog.data?.results || []}
      />
    </div>
  );
}
