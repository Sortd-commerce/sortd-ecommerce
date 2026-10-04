import { AddressPicker } from "@/components/AddressPicker";
import { CheckoutForm } from "@/components/CheckoutForm";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

type Address = {
  id: number;
  line1: string;
  city: string;
  formatted_address: string;
};

type Slot = {
  date: string;
  start_time: string;
  end_time: string;
  remaining: number;
  window_id: number;
  source: string;
};

export default async function CheckoutPage() {
  const [addresses, windows] = await Promise.all([
    apiFetch<Address[]>("/addresses"),
    apiFetch<Slot[]>("/delivery/windows", { auth: false }),
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
  const firstAddress = addressList[0];
  const firstSlot = slots[0];

  return (
    <div className="grid gap-8 pt-4 lg:grid-cols-[1fr_0.9fr]">
      <section className="space-y-6">
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-forest">Checkout</h1>

        <div className="card-quiet rounded-[1.8rem] p-6">
          <h2 className="font-semibold text-forest">Delivery address</h2>
          {addressList.length ? (
            <ul className="mt-3 space-y-2 text-sm text-ink/75">
              {addressList.map((address) => (
                <li key={address.id}>
                  #{address.id} · {address.formatted_address || `${address.line1}, ${address.city}`}
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p className="mt-2 text-sm text-ink/65">
                Search for your address or use your current location. We only save places we can deliver to.
              </p>
              <AddressPicker />
            </>
          )}
        </div>

        <div className="card-quiet rounded-[1.8rem] p-6">
          <h2 className="font-semibold text-forest">Delivery windows</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink/75">
            {slots.slice(0, 8).map((slot) => (
              <li key={`${slot.date}-${slot.window_id}-${slot.start_time}`}>
                {slot.date} · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} · {slot.remaining} left
              </li>
            ))}
            {!slots.length ? <li>No open windows right now.</li> : null}
          </ul>
        </div>
      </section>

      <section className="card-quiet h-fit rounded-[1.8rem] p-6">
        <h2 className="font-semibold text-forest">Place order</h2>
        <p className="mt-2 text-sm text-ink/65">Cash on delivery. Your browser cart is synced right before we place it.</p>
        <CheckoutForm
          addressId={firstAddress?.id || ""}
          date={firstSlot?.date || ""}
          windowId={firstSlot?.window_id || ""}
          windowSource={firstSlot?.source || "weekly"}
          disabled={!firstAddress || !firstSlot}
        />
      </section>
    </div>
  );
}
