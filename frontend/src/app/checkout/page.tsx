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
      <div className="pt-8">
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-forest">Checkout</h1>
        <p className="mt-3">
          <Link href="/login" className="text-citrus">
            Log in
          </Link>{" "}
          to checkout. Your cart is saved in this browser.
        </p>
      </div>
    );
  }

  const addressList = addresses.data || [];
  const slots = (windows.data || []).filter((slot) => slot.remaining > 0);
  const methods = payments.data || [];

  return (
    <div className="space-y-6 pt-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-forest md:text-5xl">Checkout</h1>
        <p className="mt-2 text-ink/65">Confirm address, delivery window, and payment.</p>
      </div>
      <CheckoutForm addresses={addressList} slots={slots} paymentMethods={methods} />
    </div>
  );
}
