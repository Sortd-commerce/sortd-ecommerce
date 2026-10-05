import { Suspense } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { CartLink } from "@/components/CartLink";
import { SearchField } from "@/components/SearchField";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";

type Category = { name: string; slug: string };
type Address = { formatted_address: string; line1: string; city: string; is_default?: boolean };
type Catalog = { count: number };

export async function SiteHeader() {
  const signedIn = Boolean(await getAccessToken());
  const [catalog, categories, addresses] = await Promise.all([
    apiFetch<Catalog>("/products?page_size=1", { auth: false }),
    apiFetch<Category[]>("/categories", { auth: false }),
    signedIn ? apiFetch<Address[]>("/addresses") : Promise.resolve(null),
  ]);
  const count = catalog.data?.count || 0;
  const hint = (categories.data || [])
    .slice(0, 3)
    .map((category) => category.name.toLowerCase())
    .join(", ");
  const saved = addresses?.data?.find((row) => row.is_default) || addresses?.data?.[0];
  const deliverTo = saved?.formatted_address || (saved ? `${saved.line1}, ${saved.city}` : "Dubai");

  return (
    <header className="site-header">
      <div className="deliver-bar">
        <div className="shell deliver-row">
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5" />
          </svg>
          <span>Delivering to</span>
          <Link href={signedIn ? "/checkout" : "/login"} className="deliver-place">
            {deliverTo}
            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M7 10h10l-5 6z" />
            </svg>
          </Link>
        </div>
      </div>
      <div className="shell header-main">
        <BrandMark />
        <Suspense fallback={<div className="search-form" aria-hidden />}>
          <SearchField count={count} hint={hint} />
        </Suspense>
        <nav className="header-nav" aria-label="Account">
          <Link href={signedIn ? "/orders" : "/login"} className="members-link">
            Members
          </Link>
          {signedIn ? (
            <form action={logoutAction}>
              <button type="submit" className="logout-link">
                Log out
              </button>
            </form>
          ) : null}
          <CartLink />
        </nav>
      </div>
    </header>
  );
}
