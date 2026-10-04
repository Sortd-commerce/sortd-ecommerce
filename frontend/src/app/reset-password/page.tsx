import { resetPasswordAction } from "@/lib/actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PasswordField } from "@/components/PasswordField";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div className="mx-auto max-w-lg pt-8">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-forest">Choose a new password</h1>
      <p className="mt-2 max-w-[65ch] text-ink/70">Use the link from your email. This form will not work without a valid token.</p>
      <ActionForm action={resetPasswordAction} className="card-quiet mt-8 grid gap-4 rounded-xl p-6">
        <input type="hidden" name="token" defaultValue={token || ""} />
        <PasswordField autoComplete="new-password" minLength={8} label="New password" />
        <SubmitButton pendingLabel="Updating…">Update password</SubmitButton>
      </ActionForm>
    </div>
  );
}
