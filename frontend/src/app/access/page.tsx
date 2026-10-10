import { redirect } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { StorefrontAccessForm } from "@/components/StorefrontAccessForm";
import { safeRedirectPath } from "@/lib/redirect";
import { isSitePasswordGateEnabled } from "@/lib/site-access";

export default async function StorefrontAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (!isSitePasswordGateEnabled()) redirect("/");

  const { next } = await searchParams;
  const nextPath = safeRedirectPath(next);

  return (
    <main className="store-access-page">
      <section className="store-access-card" aria-labelledby="store-access-title">
        <BrandMark href={null} />
        <div className="store-access-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="12" cy="15" r="1" fill="currentColor" />
          </svg>
        </div>
        <p className="store-access-eyebrow">Private preview</p>
        <h1 id="store-access-title">A little more access, please.</h1>
        <p className="store-access-copy">Enter the password you were given to explore the Sortd store.</p>
        <StorefrontAccessForm nextPath={nextPath} />
        <p className="store-access-footnote">Only what passes. Everything else is removed.</p>
      </section>
    </main>
  );
}
