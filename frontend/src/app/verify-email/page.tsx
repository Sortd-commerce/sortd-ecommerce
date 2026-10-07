import { redirect } from "next/navigation";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email = "" } = await searchParams;
  const query = new URLSearchParams({ auth: "signup" });
  if (email) query.set("email", email);
  redirect(`/?${query.toString()}`);
}
