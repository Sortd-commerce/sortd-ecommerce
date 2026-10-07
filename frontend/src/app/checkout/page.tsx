import { CheckoutForm } from "@/components/CheckoutForm";
import { CheckoutGuestGate } from "@/components/CheckoutGuestGate";
import { apiFetch } from "@/lib/api";

type Address = {
  id: number;
  line1: string;
  city: string;
  formatted_address: string;
  is_default?: boolean;
  place_id?: string;
  latitude?: string | null;
  longitude?: string | null;
  postal_code?: string;
};

type Slot = {
  date: string;
  start_time: string;
  end_time: string;
  remaining: number;
  window_id: number;
  source: string;
  status: "available" | "passed" | "full";
};

type PaymentMethod = {
  code: string;
  name: string;
  is_active: boolean;
};

export default async function CheckoutPage() {
  const [addresses, windows, payments] = await Promise.all([
    apiFetch<Address[]>("/addresses"),
    apiFetch<Slot[]>("/delivery/windows", { auth: false }),
    apiFetch<PaymentMethod[]>("/payments/methods", { auth: false }),
  ]);

  if (addresses.status === 401) {
    return <CheckoutGuestGate />;
  }

  const addressList = addresses.data || [];
  const slots = windows.data || [];
  const methods = payments.data || [];

  return (
    <div className="checkout-page">
      <CheckoutForm addresses={addressList} slots={slots} paymentMethods={methods} />
    </div>
  );
}
