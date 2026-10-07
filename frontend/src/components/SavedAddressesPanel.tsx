"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AddressPicker } from "@/components/AddressPicker";
import { useToast } from "@/components/Toast";
import { setPrimaryAddressAction } from "@/lib/actions";

export type SavedAddressRow = {
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

function formatAddress(address: SavedAddressRow) {
  return address.formatted_address || `${address.line1}, ${address.city}`;
}

export function SavedAddressesPanel({ addresses }: { addresses: SavedAddressRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  function makePrimary(addressId: number) {
    startTransition(async () => {
      const result = await setPrimaryAddressAction(addressId);
      if (result.ok) {
        toast.success(result.message);
        refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="addresses-panel">
      {addresses.length ? (
        <ul className="addresses-list">
          {addresses.map((address) => (
            <li key={address.id} className={`addresses-row ${address.is_default ? "addresses-row--primary" : ""}`}>
              <div>
                <p className="addresses-row-label">{address.is_default ? "Primary" : "Saved address"}</p>
                <p className="addresses-row-text">{formatAddress(address)}</p>
              </div>
              {!address.is_default ? (
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  disabled={pending}
                  onClick={() => makePrimary(address.id)}
                >
                  Set as primary
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="addresses-empty">No saved addresses yet. Add one below for faster checkout.</p>
      )}

      <section className="addresses-add">
        <h2>{addresses.length ? "Add another address" : "Add your first address"}</h2>
        <p className="addresses-add-copy">We deliver across Dubai. Search for your building or use your location.</p>
        <AddressPicker
          isDefault={addresses.length === 0}
          showPrimaryToggle={addresses.length > 0}
          submitLabel={addresses.length ? "Save address" : "Save primary address"}
          onSaved={refresh}
        />
      </section>
    </div>
  );
}
