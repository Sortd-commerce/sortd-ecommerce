import { CheckoutForm } from "@/components/CheckoutForm";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

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
    return (
      <div className="checkout-page">
        <h1>Checkout</h1>
        <p className="fine-print">
          <Link href="/login">Log in</Link> to checkout. Your basket stays in this browser.
        </p>
      </div>
    );
  }

  const addressList = addresses.data || [];
  const slots = (windows.data || []).filter((slot) => slot.remaining > 0);
  const methods = payments.data || [];

  return (
    <div className="checkout-page">
      <Link href="/cart" className="back-link">
        Back to basket
      </Link>
      <h1>Checkout</h1>
      <CheckoutForm addresses={addressList} slots={slots} paymentMethods={methods} />
    </div>
  );
}
