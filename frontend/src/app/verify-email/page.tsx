import Link from "next/link";
import { resendVerificationAction } from "@/lib/actions";
import { unwrapVerificationToken } from "@/lib/verification";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AutoVerify } from "./AutoVerify";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const params = await searchParams;
  const token = unwrapVerificationToken(params.token || "");

  if (token) {
    return (
      <div className="mx-auto max-w-lg pt-8">
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-forest">Verify your email</h1>
        <p className="mt-2 max-w-[65ch] text-ink/70">This page opened from your magic link. We’ll sign you in next.</p>
        <AutoVerify token={token} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg pt-8">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-forest">Check your email</h1>
      <p className="mt-2 max-w-[65ch] text-ink/70">
        {params.email
          ? `We sent a magic link to ${params.email}. Open that message, tap the verify button, then close this tab.`
          : "Open the magic link we emailed you, then close this tab."}
      </p>
      <ActionForm action={resendVerificationAction} className="card-quiet mt-8 grid gap-4 rounded-xl p-6">
        {params.email ? (
          <input type="hidden" name="email" value={params.email} />
        ) : (
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" spellCheck={false} required />
          </label>
        )}
        <SubmitButton pendingLabel="Sending…">Resend link</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-sm text-ink/60">
        Already verified?{" "}
        <Link href="/login" className="font-semibold text-forest">
          Log in
        </Link>
      </p>
    </div>
  );
}
