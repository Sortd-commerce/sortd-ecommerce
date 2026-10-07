import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/redirect";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "" } = await searchParams;
  const returnTo = safeRedirectPath(next);
  const query = new URLSearchParams({ auth: "signup" });
  if (returnTo) query.set("next", returnTo);
  redirect(`/?${query.toString()}`);
}
