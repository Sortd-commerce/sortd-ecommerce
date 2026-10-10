"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { StatusBadge } from "@/components/StatusBadge";
import { deleteWindowAction, updateWindowAction } from "@/lib/actions";
import { WEEKDAYS } from "@/lib/delivery";

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
  const weekday = WEEKDAYS[row.weekday] ?? "Unknown day";

  return (
    <>
      <tr>
        <td>
          <span className="font-medium">{weekday}</span>
        </td>
        <td className="whitespace-nowrap tabular-nums">{start}–{end}</td>
        <td className="tabular-nums">{row.capacity} orders</td>
        <td className="tabular-nums">{row.cutoff_minutes} min</td>
        <td><StatusBadge value={row.is_active ? "active" : "inactive"} /></td>
        <td className="text-right">
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost text-sm" onClick={() => setEditing((value) => !value)}>
              {editing ? "Close" : "Edit"}
            </button>
            <ActionForm action={deleteWindowAction}>
              <input type="hidden" name="window_id" value={row.id} />
              <SubmitButton className="btn-danger text-sm" pendingLabel="Removing…">Remove</SubmitButton>
            </ActionForm>
          </div>
        </td>
      </tr>
      {editing ? (
        <tr>
          <td colSpan={6} className="bg-panel-2/50">
            <ActionForm action={updateWindowAction} className="grid gap-4 p-2 md:grid-cols-3" successLabel="Window saved.">
              <input type="hidden" name="window_id" value={row.id} />
              <label className="field">
                <span>Weekday</span>
                <select name="weekday" defaultValue={row.weekday}>
                  {WEEKDAYS.map((label, index) => <option key={label} value={index}>{label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Start time</span>
                <input name="start_time" type="time" defaultValue={start} required />
              </label>
              <label className="field">
                <span>End time</span>
                <input name="end_time" type="time" defaultValue={end} required />
              </label>
              <label className="field">
                <span>Order capacity</span>
                <input name="capacity" type="number" min={1} defaultValue={row.capacity} required />
              </label>
              <label className="field">
                <span>Booking cutoff (minutes)</span>
                <input name="cutoff_minutes" type="number" min={0} defaultValue={row.cutoff_minutes} />
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-muted">
                <input name="is_active" type="checkbox" defaultChecked={row.is_active} /> Available to customers
              </label>
              <div className="flex gap-2 md:col-span-3">
                <SubmitButton>Save slot</SubmitButton>
                <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </ActionForm>
          </td>
        </tr>
      ) : null}
    </>
  );
}
