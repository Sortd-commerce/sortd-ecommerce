import { Suspense } from "react";
import { CheckoutAddressesLoader } from "@/components/CheckoutAddresses";
import { CheckoutAddressSkeleton } from "@/components/CheckoutAddressSection";
import { CheckoutForm } from "@/components/CheckoutForm";
import { CheckoutGuestGate } from "@/components/CheckoutGuestGate";
import {
  fetchCheckoutPaymentMethods,
  fetchCheckoutWindows,
} from "@/lib/checkout";
import { getAccessToken } from "@/lib/auth";

export default async function CheckoutPage() {
  const access = await getAccessToken();
  if (!access) {
    return <CheckoutGuestGate />;
  }

  const [windows, payments] = await Promise.all([
    fetchCheckoutWindows(),
    fetchCheckoutPaymentMethods(),
  ]);

  const slots = windows.data || [];
  const methods = payments.data || [];

  return (
    <div className="checkout-page">
      <CheckoutForm
        slots={slots}
        paymentMethods={methods}
        addressStep={
          <Suspense fallback={<CheckoutAddressSkeleton />}>
            <CheckoutAddressesLoader />
          </Suspense>
        }
      />
    </div>
  );
}
