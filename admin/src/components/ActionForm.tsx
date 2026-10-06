"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action-state";

export const emptyActionState: ActionState = { ok: null, message: "" };

function SubmitSpinner() {
  return <span className="btn-spinner" aria-hidden />;
}

export function SubmitButton({
  children,
  className = "btn",
  pendingLabel = "Saving…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <SubmitSpinner />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function ActionForm({
  action,
  className,
  children,
  successLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  className?: string;
  children: React.ReactNode;
  successLabel?: string;
}) {
  const [state, formAction] = useActionState(action, emptyActionState);
  return (
    <form action={formAction} className={className}>
      {children}
      {state.message ? (
        <p
          className={`text-sm ${state.ok ? "text-accent" : "text-warn"}`}
          aria-live="polite"
          role={state.ok ? "status" : "alert"}
        >
          {state.ok && successLabel ? successLabel : state.message}
        </p>
      ) : null}
    </form>
  );
}
