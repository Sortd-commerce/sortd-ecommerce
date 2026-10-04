"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action-state";

export const emptyActionState: ActionState = { ok: null, message: "" };

export function SubmitButton({
  children,
  className = "btn btn-primary",
  pendingLabel = "Saving…",
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function ActionForm({
  action,
  className,
  children,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, emptyActionState);
  return (
    <form action={formAction} className={className}>
      {children}
      {state.message ? (
        <p
          className={`text-sm ${state.ok ? "text-leaf" : "text-citrus"}`}
          aria-live="polite"
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
