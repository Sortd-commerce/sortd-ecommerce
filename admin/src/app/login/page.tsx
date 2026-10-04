import { loginAction } from "@/lib/actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PasswordField } from "@/components/PasswordField";

export default function AdminLoginPage() {
  return (
    <div className="mx-auto max-w-md pt-16">
      <h1 className="text-pretty text-3xl font-semibold text-accent">Staff login</h1>
      <p className="mt-2 text-muted">Use a verified staff account.</p>
      <ActionForm action={loginAction} className="panel mt-8 grid gap-4 p-6">
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <PasswordField autoComplete="current-password" />
        <SubmitButton pendingLabel="Signing in…">Enter admin</SubmitButton>
      </ActionForm>
    </div>
  );
}
