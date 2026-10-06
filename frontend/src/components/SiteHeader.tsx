import { Suspense } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { CartLink } from "@/components/CartLink";
import { AccountIcon, CaretDownIcon, DeliverPinIcon } from "@/components/HeaderIcons";
import { SearchField } from "@/components/SearchField";
import { DeliverBarSkeleton, SearchFormSkeleton } from "@/components/loading/StorefrontSkeletons";
import { fetchCatalogCount, fetchCategories, fetchPricingRules } from "@/lib/catalog";
import { apiFetch } from "@/lib/api";

type Address = { formatted_address: string; line1: string; city: string; is_default?: boolean };

async function DeliverBar({ signedIn }: { signedIn: boolean }) {
  const [addresses, pricing] = await Promise.all([
    signedIn ? apiFetch<Address[]>("/addresses") : Promise.resolve(null),
    fetchPricingRules(),
  ]);
  const saved =
    signedIn && addresses?.ok
      ? addresses.data?.find((row) => row.is_default) || addresses.data?.[0]
      : null;
  const deliverTo = saved
    ? saved.formatted_address || `${saved.line1}, ${saved.city}`
    : null;
  const freeMinimum = pricing.data?.free_delivery_minimum || "99.00";

  return (
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
  );
}

async function HeaderSearch() {
  const [catalog, categories] = await Promise.all([fetchCatalogCount(), fetchCategories()]);
  const count = catalog.data?.count || 0;
  const categoryCount = categories.data?.length || 0;
  const hint = (categories.data || [])
    .slice(0, 3)
    .map((category) => category.name.toLowerCase())
    .join(", ");

  return <SearchField count={count} hint={hint} categoryCount={categoryCount} />;
}

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="site-header">
      <Suspense fallback={<DeliverBarSkeleton />}>
        <DeliverBar signedIn={signedIn} />
      </Suspense>
      <div className="header-main">
        <div className="header-inner header-row">
          <BrandMark />
          <Suspense fallback={<SearchFormSkeleton />}>
            <HeaderSearch />
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
