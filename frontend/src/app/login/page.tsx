import Link from "next/link";
import { loginAction } from "@/lib/actions";
import { safeRedirectPath } from "@/lib/redirect";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { DeviceIdField } from "@/components/DeviceIdField";
import { PasswordField } from "@/components/PasswordField";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "" } = await searchParams;
  const returnTo = safeRedirectPath(next);
  const checkoutReturn = returnTo === "/checkout";

  return (
    <div className="mx-auto max-w-lg pt-8">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-forest">Welcome back</h1>
      <p className="mt-2 max-w-[65ch] text-ink/70">
        {checkoutReturn
          ? "Sign in to continue checkout. Your basket stays in this browser."
          : "Sign in after your email is verified."}
      </p>
      <ActionForm action={loginAction} className="card-quiet mt-8 grid gap-4 rounded-xl p-6">
        <input type="hidden" name="next" value={returnTo} />
        <DeviceIdField />
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" spellCheck={false} required />
        </label>
        <PasswordField autoComplete="current-password" />
        <SubmitButton pendingLabel="Signing in…">Log in</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-sm text-ink/60">
        <Link href="/forgot-password" className="font-semibold text-forest">
          Forgot password?
        </Link>
      </p>
      <p className="mt-4 text-sm text-ink/60">
        New here?{" "}
        <Link href={checkoutReturn ? "/signup?next=/checkout" : "/signup"} className="font-semibold text-forest">
          Create an account
        </Link>
      </p>
    </div>
  );
}
