import Link from "next/link";
import { SavedAddressesPanel, type SavedAddressRow } from "@/components/SavedAddressesPanel";
import { apiFetch } from "@/lib/api";

export default async function AddressesPage() {
  const addresses = await apiFetch<SavedAddressRow[]>("/addresses");

  if (addresses.status === 401) {
    return (
      <div className="addresses-page">
        <section className="addresses-guest">
          <p className="account-kicker">Delivery</p>
          <h1>Sign in to manage addresses</h1>
          <p className="addresses-guest-copy">Save delivery addresses for faster checkout across Dubai.</p>
          <div className="addresses-guest-actions">
            <Link href="/?auth=login&next=/addresses" className="btn btn-primary">
              Sign in
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="addresses-page">
      <header className="addresses-head">
        <div>
          <p className="account-kicker">Delivery</p>
          <h1>Saved addresses</h1>
          <p className="addresses-lead">Manage where we deliver in Dubai.</p>
        </div>
      </header>
      <SavedAddressesPanel addresses={addresses.data || []} />
    </div>
  );
}
