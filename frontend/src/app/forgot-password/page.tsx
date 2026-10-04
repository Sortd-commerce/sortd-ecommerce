import { forgotPasswordAction } from "@/lib/actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-lg pt-8">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-forest">Forgot password</h1>
      <p className="mt-2 max-w-[65ch] text-ink/70">We will email a reset link if that account exists and is verified.</p>
      <ActionForm action={forgotPasswordAction} className="card-quiet mt-8 grid gap-4 rounded-xl p-6">
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" spellCheck={false} required />
        </label>
        <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-sm text-ink/60">
        <Link href="/login" className="font-semibold text-forest">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
