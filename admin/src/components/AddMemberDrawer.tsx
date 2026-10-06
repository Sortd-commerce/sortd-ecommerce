"use client";

import { useActionState, useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import { SubmitButton } from "@/components/ActionForm";
import { PasswordField } from "@/components/PasswordField";
import { createMemberAction } from "@/lib/actions";
import { emptyActionState } from "@/lib/action-state";

function AddMemberForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, formAction] = useActionState(createMemberAction, emptyActionState);

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state.ok, onSuccess]);

  return (
    <form action={formAction} className="grid gap-3">
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="off" required />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>First name</span>
          <input name="first_name" />
        </label>
        <label className="field">
          <span>Last name</span>
          <input name="last_name" />
        </label>
      </div>
      <PasswordField autoComplete="new-password" />
      <label className="field">
        <span>Role</span>
        <select name="role" defaultValue="member">
          <option value="member">Member (view orders)</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <SubmitButton pendingLabel="Adding…">Add member</SubmitButton>
      {state.message && !state.ok ? (
        <p className="text-sm text-warn" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function AddMemberDrawer() {
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
        Add member
      </button>
      {open ? (
        <div className="drawer-layer">
          <button type="button" className="drawer-scrim" aria-label="Close add member panel" onClick={() => setOpen(false)} />
          <aside className="drawer-panel drawer-panel--enter" role="dialog" aria-modal="true" aria-label="Add member">
            <div className="drawer-head">
              <div>
                <h2 className="text-lg font-semibold">Add member</h2>
                <p className="mt-1 text-sm text-muted">
                  Creates a staff login, or promotes an existing shopper account.
                </p>
              </div>
              <button type="button" className="drawer-close" aria-label="Close" onClick={() => setOpen(false)}>
                <X size={18} weight="bold" />
              </button>
            </div>
            <div className="drawer-body">
              <AddMemberForm onSuccess={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
