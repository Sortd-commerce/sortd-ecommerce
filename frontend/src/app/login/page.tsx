import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/redirect";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "" } = await searchParams;
  const returnTo = safeRedirectPath(next);
  const query = new URLSearchParams({ auth: "login" });
  if (returnTo) query.set("next", returnTo);
  redirect(`/?${query.toString()}`);
}
