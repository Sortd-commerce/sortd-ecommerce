import { loginAction } from "@/lib/actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { DeviceIdField } from "@/components/DeviceIdField";
import { PasswordField } from "@/components/PasswordField";

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Sortd</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Staff login</h1>
        <p className="mt-2 text-sm text-muted">Use a verified admin or member account.</p>
        <ActionForm action={loginAction} className="panel mt-8 grid gap-4 p-6">
          <DeviceIdField />
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <PasswordField autoComplete="current-password" />
          <SubmitButton pendingLabel="Signing in…">Continue</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
