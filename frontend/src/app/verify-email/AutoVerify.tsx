"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { emptyActionState, SubmitButton } from "@/components/ActionForm";
import { getOrCreateDeviceId } from "@/components/DeviceIdField";
import { verifyEmailAction } from "@/lib/actions";

export function AutoVerify({ token }: { token: string }) {
  const [state, formAction] = useActionState(verifyEmailAction, emptyActionState);
  const [deviceId, setDeviceId] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const sent = useRef(false);

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  useEffect(() => {
    if (!deviceId || sent.current) return;
    sent.current = true;
    formRef.current?.requestSubmit();
  }, [deviceId]);

  return (
    <form ref={formRef} action={formAction} className="card-quiet mt-8 grid gap-4 rounded-xl p-6">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="device_id" value={deviceId} />
      <p className="text-sm text-ink/70">Confirming your email…</p>
      <SubmitButton pendingLabel="Verifying…">Continue</SubmitButton>
      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-leaf" : "text-citrus"}`} role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
