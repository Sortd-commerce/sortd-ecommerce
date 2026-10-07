import { CheckoutForm } from "@/components/CheckoutForm";
import { CheckoutGuestGate } from "@/components/CheckoutGuestGate";
import {
  fetchCheckoutPaymentMethods,
  fetchCheckoutWindows,
  type CheckoutAddress,
} from "@/lib/checkout";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

export default async function CheckoutPage() {
  const access = await getAccessToken();
  if (!access) {
    return <CheckoutGuestGate />;
  }

  const [windows, payments, addresses] = await Promise.all([
    fetchCheckoutWindows(),
    fetchCheckoutPaymentMethods(),
    apiFetch<CheckoutAddress[]>("/addresses"),
  ]);

  const slots = windows.data || [];
  const methods = payments.data || [];
  const savedAddresses = addresses.ok ? addresses.data || [] : [];

  return (
    <div className="checkout-page">
      <CheckoutForm slots={slots} paymentMethods={methods} addresses={savedAddresses} />
    </div>
  );
}
