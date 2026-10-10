"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AddressPicker } from "@/components/AddressPicker";
import { useToast } from "@/components/Toast";
import { setPrimaryAddressAction } from "@/lib/actions";
import { formatAddressDetails, formatAddressLabel, type DeliveryAddress } from "@/lib/address";

export type SavedAddressRow = DeliveryAddress;

export function SavedAddressesPanel({ addresses }: { addresses: SavedAddressRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const [adding, setAdding] = useState(addresses.length === 0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const editing = addresses.find((row) => row.id === editingId) || null;

  function refresh() {
    setAdding(false);
    setEditingId(null);
    startRefresh(() => {
      router.refresh();
    });
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

  const listBusy = refreshing && !adding && !editing;

  return (
    <div className="addresses-panel">
      {listBusy ? (
        <ul className="addresses-list addresses-list--skeleton" aria-busy="true" aria-label="Updating addresses">
          {Array.from({ length: Math.max(2, addresses.length || 2) }).map((_, index) => (
            <li key={index} className="addresses-skeleton-row skeleton skeleton--address-row" aria-hidden />
          ))}
        </ul>
      ) : null}
      {addresses.length && !adding && !editing && !listBusy ? (
        <ul className="addresses-list">
          {addresses.map((address) => (
            <li key={address.id} className={`addresses-row ${address.is_default ? "addresses-row--primary" : ""}`}>
              <div>
                <p className="addresses-row-meta">
                  <span className="addresses-row-label">{formatAddressLabel(address.label)}</span>
                  {address.is_default ? <span className="addresses-row-badge">Primary</span> : null}
                </p>
                <p className="addresses-row-text">{formatAddressDetails(address)}</p>
              </div>
              <div className="addresses-row-actions">
                <button type="button" className="text-action" onClick={() => setEditingId(address.id)}>
                  Edit
                </button>
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
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!addresses.length && !adding ? (
        <p className="addresses-empty">No saved addresses yet. Add one below for faster checkout.</p>
      ) : null}

      {addresses.length && !adding && !editing ? (
        <button type="button" className="text-action add-address" onClick={() => setAdding(true)}>
          + Add another address
        </button>
      ) : null}

      {editing ? (
        <section className="addresses-add">
          <div className="addresses-add-head">
            <div>
              <h2>Edit {formatAddressLabel(editing.label).toLowerCase()} address</h2>
              <p className="addresses-add-copy">Update the label, location, and building details for this delivery address.</p>
            </div>
            <button type="button" className="checkout-cancel" onClick={() => setEditingId(null)}>
              Cancel
            </button>
          </div>
          <AddressPicker
            key={editing.id}
            addressId={editing.id}
            isDefault={Boolean(editing.is_default)}
            showPrimaryToggle
            submitLabel="Update address"
            initialQuery={editing.formatted_address || editing.line1}
            initialPlace={{
              place_id: editing.place_id,
              latitude: editing.latitude,
              longitude: editing.longitude,
              postal_code: editing.postal_code,
              formatted_address: editing.formatted_address || editing.line1,
            }}
            initialDetails={{
              label: editing.label,
              community: editing.community,
              building: editing.building,
              unit: editing.unit,
              floor: editing.floor,
            }}
            onSaved={refresh}
          />
        </section>
      ) : null}

      {adding ? (
        <section className="addresses-add">
          <div className="addresses-add-head">
            <div>
              <h2>{addresses.length ? "Add another address" : "Add your first address"}</h2>
              <p className="addresses-add-copy">We deliver across Dubai. Search for your building or use your location.</p>
            </div>
            {addresses.length ? (
              <button type="button" className="checkout-cancel" onClick={() => setAdding(false)}>
                Cancel
              </button>
            ) : null}
          </div>
          <AddressPicker
            isDefault={addresses.length === 0}
            showPrimaryToggle={addresses.length > 0}
            submitLabel={addresses.length ? "Save address" : "Save primary address"}
            onSaved={refresh}
          />
        </section>
      ) : null}
    </div>
  );
}
