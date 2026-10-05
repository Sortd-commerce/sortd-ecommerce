"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { StatusBadge } from "@/components/StatusBadge";
import { deletePostalCodeAction, updatePostalCodeAction } from "@/lib/actions";

export type PostalRow = { id: number; code: string; is_active: boolean };

export function PostalEditor({ row }: { row: PostalRow }) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 first:border-t-0">
        <div>
          <p className="font-medium tabular-nums">{row.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge value={row.is_active ? "active" : "inactive"} />
          <button type="button" className="btn-ghost text-sm" onClick={() => setEditing(true)}>
            Edit
          </button>
          <ActionForm action={deletePostalCodeAction}>
            <input type="hidden" name="code_id" value={row.id} />
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
      <ActionForm action={updatePostalCodeAction} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end" successLabel="Postal code saved.">
        <input type="hidden" name="code_id" value={row.id} />
        <label className="field">
          <span>Postal code</span>
          <input name="code" defaultValue={row.code} required />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-muted">
          <input name="is_active" type="checkbox" defaultChecked={row.is_active} /> Active
        </label>
        <div className="flex gap-2">
          <SubmitButton>Save</SubmitButton>
          <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </ActionForm>
    </li>
  );
}
