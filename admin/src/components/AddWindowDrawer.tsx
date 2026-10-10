"use client";

import { useActionState, useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import { SubmitButton } from "@/components/ActionForm";
import { emptyActionState } from "@/lib/action-state";
import { createWindowAction } from "@/lib/actions";
import { WEEKDAYS } from "@/lib/delivery";

export function AddWindowDrawer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Add delivery slot
      </button>
      {open ? (
        <div className="drawer-layer">
          <button type="button" className="drawer-scrim" aria-label="Close add delivery slot panel" onClick={() => setOpen(false)} />
          <aside
            className="drawer-panel drawer-panel--wide drawer-panel--enter"
            role="dialog"
            aria-modal="true"
            aria-label="Add delivery slot"
          >
            <div className="drawer-head">
              <div>
                <h2 className="text-lg font-semibold">Add delivery slot</h2>
                <p className="mt-1 text-sm text-muted">Create a recurring weekly window customers can choose at checkout.</p>
              </div>
              <button type="button" className="drawer-close" aria-label="Close" onClick={() => setOpen(false)}>
                <X size={18} weight="bold" />
              </button>
            </div>
            <div className="drawer-body">
              <CreateWindowForm onSuccess={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function CreateWindowForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, formAction] = useActionState(createWindowAction, emptyActionState);

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [onSuccess, state.ok]);

  return (
    <form action={formAction} className="grid gap-4">
      <label className="field">
        <span>Weekday</span>
        <select name="weekday" defaultValue={0}>
          {WEEKDAYS.map((label, index) => <option key={label} value={index}>{label}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">
          <span>Starts at</span>
          <input name="start_time" type="time" defaultValue="09:00" required />
        </label>
        <label className="field">
          <span>Ends at</span>
          <input name="end_time" type="time" defaultValue="12:00" required />
        </label>
      </div>
      <label className="field">
        <span>Order capacity</span>
        <input name="capacity" type="number" min={1} defaultValue={20} required />
        <span className="text-xs text-muted">Maximum orders accepted for this delivery window.</span>
      </label>
      <label className="field">
        <span>Booking cutoff (minutes)</span>
        <input name="cutoff_minutes" type="number" min={0} defaultValue={60} required />
      </label>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input name="is_active" type="checkbox" defaultChecked /> Available to customers
      </label>
      <SubmitButton>Add delivery slot</SubmitButton>
      {state.message ? (
        <p
          className={`text-sm ${state.ok ? "text-accent" : "text-warn"}`}
          aria-live="polite"
          role={state.ok ? "status" : "alert"}
        >
          {state.ok ? "Delivery slot added." : state.message}
        </p>
      ) : null}
    </form>
  );
}
