import Link from "next/link";
import { signupAction } from "@/lib/actions";
import { safeRedirectPath } from "@/lib/redirect";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PasswordField } from "@/components/PasswordField";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "" } = await searchParams;
  const returnTo = safeRedirectPath(next);
  const checkoutReturn = returnTo === "/checkout";

  return (
    <div className="mx-auto max-w-lg pt-8">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-forest">Create your account</h1>
      <p className="mt-2 max-w-[65ch] text-ink/70">
        {checkoutReturn
          ? "Create an account to finish checkout. We’ll email a magic link — open it to verify."
          : "We’ll email a magic link. Open that link to verify — no codes to copy."}
      </p>
      <ActionForm action={signupAction} className="card-quiet mt-8 grid gap-4 rounded-xl p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            <span>First name</span>
            <input name="first_name" autoComplete="given-name" required />
          </label>
          <label className="field">
            <span>Last name</span>
            <input name="last_name" autoComplete="family-name" required />
          </label>
        </div>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" spellCheck={false} required />
        </label>
        <label className="field">
          <span>Phone</span>
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+971501234567…" required />
        </label>
        <PasswordField autoComplete="new-password" minLength={8} />
        <SubmitButton pendingLabel="Creating account…">Sign up</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-sm text-ink/60">
        Already verified?{" "}
        <Link href={checkoutReturn ? "/login?next=/checkout" : "/login"} className="font-semibold text-forest">
          Log in
        </Link>
      </p>
    </div>
  );
}
