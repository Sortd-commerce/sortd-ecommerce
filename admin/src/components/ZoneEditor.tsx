"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { DirhamIcon } from "@/components/DirhamIcon";
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

  return (
    <>
      <tr>
        <td>
          <p className="font-medium">{zone.name}</p>
          <p className="mt-0.5 text-xs text-muted">{zone.slug}</p>
        </td>
        <td>{zone.polygon.length} boundary points</td>
        <td className="whitespace-nowrap tabular-nums"><DirhamIcon /> {zone.delivery_fee}</td>
        <td className="tabular-nums">{zone.sort_order}</td>
        <td><StatusBadge value={zone.is_active ? "active" : "inactive"} /></td>
        <td className="text-right">
          <div className="flex justify-end gap-2">
            <ActionForm action={toggleDeliveryZoneAction}>
              <input type="hidden" name="zone_id" value={zone.id} />
              <input type="hidden" name="is_active" value={zone.is_active ? "false" : "true"} />
              <SubmitButton className="btn-ghost text-sm" pendingLabel="Saving…">
                {zone.is_active ? "Disable" : "Enable"}
              </SubmitButton>
            </ActionForm>
            <button type="button" className="btn-ghost text-sm" onClick={() => setEditing((value) => !value)}>
              {editing ? "Close" : "Edit"}
            </button>
            <ActionForm action={deleteDeliveryZoneAction}>
              <input type="hidden" name="zone_id" value={zone.id} />
              <SubmitButton className="btn-danger text-sm" pendingLabel="Removing…">Remove</SubmitButton>
            </ActionForm>
          </div>
        </td>
      </tr>
      {editing ? (
        <tr>
          <td colSpan={6} className="bg-panel-2/50">
            <ActionForm action={updateDeliveryZoneAction} className="grid gap-4 p-2" successLabel="Delivery zone saved.">
              <input type="hidden" name="zone_id" value={zone.id} />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="field">
                  <span>Zone name</span>
                  <input name="name" defaultValue={zone.name} required />
                </label>
                <label className="field">
                  <span>Slug</span>
                  <input name="slug" defaultValue={zone.slug} required />
                </label>
                <label className="field">
                  <span>Delivery fee (<DirhamIcon />)</span>
                  <input name="delivery_fee" type="number" min="0" step="0.01" defaultValue={zone.delivery_fee} required />
                </label>
                <label className="field">
                  <span>Display order</span>
                  <input name="sort_order" type="number" min="0" defaultValue={zone.sort_order} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input name="is_active" type="checkbox" defaultChecked={zone.is_active} /> Active and serviceable
              </label>
              <div>
                <p className="mb-2 text-sm font-medium">Service boundary</p>
                <ZonePolygonMap initialPolygon={normalizePolygon(zone.polygon)} onChange={setPolygon} />
              </div>
              <input type="hidden" name="polygon" value={JSON.stringify(polygon)} />
              <div className="flex gap-2">
                <SubmitButton>Save zone</SubmitButton>
                <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </ActionForm>
          </td>
        </tr>
      ) : null}
    </>
  );
}
