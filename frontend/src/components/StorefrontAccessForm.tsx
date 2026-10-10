"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ActionForm";
import { PasswordField } from "@/components/PasswordField";
import { emptyActionState } from "@/lib/action-state";
import { unlockStorefrontAction } from "@/lib/actions";

export function StorefrontAccessForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState(unlockStorefrontAction, emptyActionState);

  return (
    <form action={formAction} className="store-access-form">
      <input type="hidden" name="next" value={nextPath} />
      <PasswordField
        label="Access password"
        autoComplete="current-password"
        maxLength={1024}
        autoFocus
      />
      {state.message ? (
        <p className="store-access-error" role="alert" aria-live="polite">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="btn btn-primary store-access-submit" pendingLabel="Checking…">
        Enter the store
      </SubmitButton>
    </form>
  );
}
