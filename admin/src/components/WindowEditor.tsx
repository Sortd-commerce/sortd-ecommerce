"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { StatusBadge } from "@/components/StatusBadge";
import { deleteWindowAction, updateWindowAction } from "@/lib/actions";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export type DeliveryWindowRow = {
  id: number;
  weekday: number;
  start_time: string;
  end_time: string;
  capacity: number;
  cutoff_minutes: number;
  is_active: boolean;
};

export function WindowEditor({ window: row }: { window: DeliveryWindowRow }) {
  const [editing, setEditing] = useState(false);
  const start = row.start_time.slice(0, 5);
  const end = row.end_time.slice(0, 5);

  if (!editing) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 first:border-t-0">
        <div>
          <p className="font-medium">
            {WEEKDAYS[row.weekday]} {start}–{end}
          </p>
          <p className="mt-1 text-sm text-muted">
            {row.capacity} orders · cutoff {row.cutoff_minutes} min
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge value={row.is_active ? "active" : "inactive"} />
          <button type="button" className="btn-ghost text-sm" onClick={() => setEditing(true)}>
            Edit
          </button>
          <ActionForm action={deleteWindowAction}>
            <input type="hidden" name="window_id" value={row.id} />
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
      <ActionForm action={updateWindowAction} className="grid gap-3" successLabel="Window saved.">
        <input type="hidden" name="window_id" value={row.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            <span>Weekday</span>
            <select name="weekday" defaultValue={row.weekday}>
              {WEEKDAYS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm text-muted">
            <input name="is_active" type="checkbox" defaultChecked={row.is_active} /> Active
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            <span>Start</span>
            <input name="start_time" type="time" defaultValue={start} required />
          </label>
          <label className="field">
            <span>End</span>
            <input name="end_time" type="time" defaultValue={end} required />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            <span>Capacity</span>
            <input name="capacity" type="number" min={1} defaultValue={row.capacity} required />
          </label>
          <label className="field">
            <span>Cutoff minutes</span>
            <input name="cutoff_minutes" type="number" min={0} defaultValue={row.cutoff_minutes} />
          </label>
        </div>
        <div className="flex gap-2">
          <SubmitButton>Save window</SubmitButton>
          <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </ActionForm>
    </li>
  );
}
