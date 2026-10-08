"use client";

import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/ActionForm";
import { ZonePolygonMap, type LatLngTuple } from "@/components/ZonePolygonMap";
import { createDeliveryZoneAction } from "@/lib/actions";
import { emptyActionState } from "@/lib/action-state";

export function CreateZoneForm({ onSuccess }: { onSuccess?: () => void }) {
  const [polygon, setPolygon] = useState<LatLngTuple[]>([]);
  const [state, formAction] = useActionState(createDeliveryZoneAction, emptyActionState);

  useEffect(() => {
    if (state.ok) onSuccess?.();
  }, [state.ok, onSuccess]);

  return (
    <form action={formAction} className="grid gap-4">
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
      {state.message ? (
        <p
          className={`text-sm ${state.ok ? "text-accent" : "text-warn"}`}
          aria-live="polite"
          role={state.ok ? "status" : "alert"}
        >
          {state.ok ? "Delivery zone added." : state.message}
        </p>
      ) : null}
    </form>
  );
}
