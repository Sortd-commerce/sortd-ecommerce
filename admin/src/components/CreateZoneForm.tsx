"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { ZonePolygonMap } from "@/components/ZonePolygonMap";
import { createDeliveryZoneAction } from "@/lib/actions";

export function CreateZoneForm() {
  const [polygon, setPolygon] = useState<number[][]>([]);

  return (
    <ActionForm action={createDeliveryZoneAction} className="mt-3 grid gap-4" successLabel="Delivery zone added.">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="field">
          <span>Zone name</span>
          <input name="name" placeholder="Dubai Marina" required />
        </label>
        <label className="field">
          <span>Slug</span>
          <input name="slug" placeholder="dubai-marina" />
        </label>
        <label className="field">
          <span>Delivery fee (AED)</span>
          <input name="delivery_fee" type="number" min="0" step="0.01" defaultValue="0" />
        </label>
        <label className="field">
          <span>Sort order</span>
          <input name="sort_order" type="number" min="0" defaultValue="0" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input name="is_active" type="checkbox" defaultChecked /> Active
      </label>
      <div>
        <p className="mb-2 text-sm font-medium">Draw boundary</p>
        <ZonePolygonMap onChange={setPolygon} />
      </div>
      <input type="hidden" name="polygon" value={JSON.stringify(polygon)} />
      <SubmitButton>Add delivery zone</SubmitButton>
    </ActionForm>
  );
}
