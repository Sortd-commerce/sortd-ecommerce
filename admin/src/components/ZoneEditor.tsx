"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { StatusBadge } from "@/components/StatusBadge";
import { normalizePolygon, ZonePolygonMap, type LatLngTuple } from "@/components/ZonePolygonMap";
import { deleteDeliveryZoneAction, toggleDeliveryZoneAction, updateDeliveryZoneAction } from "@/lib/actions";

export type DeliveryZoneRow = {
  id: number;
  name: string;
  slug: string;
  polygon: number[][];
  delivery_fee: string;
  is_active: boolean;
  sort_order: number;
};

export function ZoneEditor({ zone }: { zone: DeliveryZoneRow }) {
  const [editing, setEditing] = useState(false);
  const [polygon, setPolygon] = useState<LatLngTuple[]>(() => normalizePolygon(zone.polygon));

  if (!editing) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 first:border-t-0">
        <div>
          <p className="font-medium">{zone.name}</p>
          <p className="text-sm text-muted">
            {zone.slug} · AED {zone.delivery_fee} · {zone.polygon.length} points
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge value={zone.is_active ? "active" : "inactive"} />
          <ActionForm action={toggleDeliveryZoneAction}>
            <input type="hidden" name="zone_id" value={zone.id} />
            <input type="hidden" name="is_active" value={zone.is_active ? "false" : "true"} />
            <SubmitButton className="btn-ghost text-sm" pendingLabel="Saving…">
              {zone.is_active ? "Disable" : "Enable"}
            </SubmitButton>
          </ActionForm>
          <button type="button" className="btn-ghost text-sm" onClick={() => setEditing(true)}>
            Edit
          </button>
          <ActionForm action={deleteDeliveryZoneAction}>
            <input type="hidden" name="zone_id" value={zone.id} />
            <SubmitButton className="btn-danger" pendingLabel="Removing…">
              Remove
            </SubmitButton>
          </ActionForm>
        </div>
      </li>
    );
  }

  return (
    <li className="border-t border-line px-4 py-4 first:border-t-0">
      <ActionForm
        action={updateDeliveryZoneAction}
        className="grid gap-4"
        successLabel="Delivery zone saved."
      >
        <input type="hidden" name="zone_id" value={zone.id} />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="field">
            <span>Zone name</span>
            <input name="name" defaultValue={zone.name} required />
          </label>
          <label className="field">
            <span>Slug</span>
            <input name="slug" defaultValue={zone.slug} required />
          </label>
          <label className="field">
            <span>Delivery fee (AED)</span>
            <input name="delivery_fee" type="number" min="0" step="0.01" defaultValue={zone.delivery_fee} />
            <span className="text-xs text-muted">Stored for future use. Checkout still uses the global delivery fee.</span>
          </label>
          <label className="field">
            <span>Sort order</span>
            <input name="sort_order" type="number" min="0" defaultValue={zone.sort_order} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input name="is_active" type="checkbox" defaultChecked={zone.is_active} /> Active
        </label>
        <div>
          <p className="mb-2 text-sm font-medium">Boundary</p>
          <ZonePolygonMap initialPolygon={normalizePolygon(zone.polygon)} onChange={setPolygon} />
        </div>
        <input type="hidden" name="polygon" value={JSON.stringify(polygon)} />
        <div className="flex gap-2">
          <SubmitButton>Save zone</SubmitButton>
          <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </ActionForm>
    </li>
  );
}
