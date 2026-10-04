import { placeOrderAction, saveAddressAction } from "@/lib/actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
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

type Cart = { subtotal: string; items: Array<{ id: number }> };

export default async function CheckoutPage() {
  const [addresses, windows, cart] = await Promise.all([
    apiFetch<Address[]>("/addresses"),
    apiFetch<Slot[]>("/delivery/windows", { auth: false }),
    apiFetch<Cart>("/cart"),
  ]);

  if (addresses.status === 401 || cart.status === 401) {
    return (
      <div className="pt-8">
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-forest">Checkout</h1>
        <p className="mt-3">
          <Link href="/login" className="text-citrus">
            Log in
          </Link>{" "}
          to checkout.
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
            <ActionForm action={saveAddressAction} className="mt-4 grid gap-3">
              <label className="field">
                <span>Address line</span>
                <input name="line1" required />
              </label>
              <label className="field">
                <span>City</span>
                <input name="city" defaultValue="Dubai" required />
              </label>
              <label className="field">
                <span>Formatted address for geocode</span>
                <input name="formatted_address" placeholder="dubai marina" required />
              </label>
              <label className="field">
                <span>Place ID (optional)</span>
                <input name="place_id" placeholder="fixture-dubai-marina" />
              </label>
              <SubmitButton className="btn btn-secondary">Save address</SubmitButton>
            </ActionForm>
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
        <p className="mt-2 text-sm text-ink/65">Cash on delivery. Total is rechecked on the server.</p>
        <ActionForm action={placeOrderAction} className="mt-5 grid gap-3">
          <label className="field">
            <span>Address ID</span>
            <input name="address_id" defaultValue={firstAddress?.id || ""} required />
          </label>
          <label className="field">
            <span>Delivery date</span>
            <input name="delivery_date" defaultValue={firstSlot?.date || ""} required />
          </label>
          <label className="field">
            <span>Window ID</span>
            <input name="window_id" defaultValue={firstSlot?.window_id || ""} required />
          </label>
          <input type="hidden" name="window_source" value={firstSlot?.source || "weekly"} />
          <label className="field">
            <span>Expected total</span>
            <input name="expected_total" defaultValue={cart.data?.subtotal || ""} required />
          </label>
          <label className="field">
            <span>Delivery note</span>
            <textarea name="note" rows={3} />
          </label>
          <SubmitButton className="btn btn-primary" pendingLabel="Placing order…" disabled={!firstAddress || !firstSlot}>
            Place COD order
          </SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
