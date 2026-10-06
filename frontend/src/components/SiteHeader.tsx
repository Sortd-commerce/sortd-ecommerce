import { Suspense } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { CartLink } from "@/components/CartLink";
import { AccountIcon, CaretDownIcon, DeliverPinIcon } from "@/components/HeaderIcons";
import { SearchField } from "@/components/SearchField";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type Category = { name: string; slug: string };
type Address = { formatted_address: string; line1: string; city: string; is_default?: boolean };
type Catalog = { count: number };
type PricingRules = { free_delivery_minimum: string };

export async function SiteHeader() {
  const signedIn = Boolean(await getAccessToken());
  const [catalog, categories, addresses, pricing] = await Promise.all([
    apiFetch<Catalog>("/products?page_size=1", { auth: false }),
    apiFetch<Category[]>("/categories", { auth: false }),
    signedIn ? apiFetch<Address[]>("/addresses") : Promise.resolve(null),
    apiFetch<PricingRules>("/pricing", { auth: false }),
  ]);
  const count = catalog.data?.count || 0;
  const categoryCount = categories.data?.length || 0;
  const hint = (categories.data || [])
    .slice(0, 3)
    .map((category) => category.name.toLowerCase())
    .join(", ");
  const saved =
    signedIn && addresses?.ok
      ? addresses.data?.find((row) => row.is_default) || addresses.data?.[0]
      : null;
  const deliverTo = saved
    ? saved.formatted_address || `${saved.line1}, ${saved.city}`
    : null;
  const freeMinimum = pricing.data?.free_delivery_minimum || "99.00";

  return (
    <header className="site-header">
      <div className="deliver-bar">
        <div className="header-inner deliver-row">
          <div className="deliver-location">
            <DeliverPinIcon />
            <span className="deliver-label">Delivering to</span>
            {deliverTo ? (
              <Link href="/checkout" className="deliver-place">
                {deliverTo}
                <CaretDownIcon />
              </Link>
            ) : signedIn ? (
              <Link href="/checkout" className="deliver-place deliver-place--cta">
                Add your address
                <CaretDownIcon />
              </Link>
            ) : (
              <p className="deliver-signin-prompt">
                Not signed in yet?{" "}
                <Link href="/login?next=/checkout" className="deliver-signin-link">
                  Sign in
                </Link>
              </p>
            )}
          </div>
          <div className="deliver-promise">
            <span>Delivery in 30 minutes</span>
            <span className="deliver-free">Free over AED {Number(freeMinimum).toFixed(0)}</span>
          </div>
        </div>
      </div>
      <div className="header-main">
        <div className="header-inner header-row">
          <BrandMark />
          <Suspense fallback={<div className="search-form" aria-hidden />}>
            <SearchField count={count} hint={hint} categoryCount={categoryCount} />
          </Suspense>
          <nav className="header-nav" aria-label="Account">
            <Link href={signedIn ? "/account" : "/login?next=/account"} className="header-link">
              Membership
            </Link>
            <span className="header-link header-link-static">What we reject</span>
            <Link
              href={signedIn ? "/account" : "/login?next=/account"}
              className="header-account"
              aria-label="Account"
            >
              <AccountIcon />
            </Link>
            <CartLink />
          </nav>
        </div>
      </div>
    </header>
  );
}
