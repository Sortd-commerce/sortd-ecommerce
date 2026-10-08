import { Suspense } from "react";
import Link from "next/link";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { AuthOpenButton } from "@/components/auth/AuthOpenButton";
import type { AuthUser } from "@/components/auth/AuthProvider";
import { BrandMark } from "@/components/BrandMark";
import { CartLink } from "@/components/CartLink";
import { MobileAccountTrigger } from "@/components/MobileAccountTrigger";
import { CaretDownIcon, DeliverPinIcon } from "@/components/HeaderIcons";
import { SearchField } from "@/components/SearchField";
import { DeliverBarSkeleton, SearchFormSkeleton } from "@/components/loading/StorefrontSkeletons";
import { fetchCatalogCount, fetchCategories, fetchPricingRules } from "@/lib/catalog";
import { normalizeDeliveryPromise } from "@/lib/pricing";
import { apiFetch } from "@/lib/api";

type Address = { formatted_address: string; line1: string; city: string; is_default?: boolean };

function deliverShortLabel(address: Address) {
  const raw = address.formatted_address || address.line1;
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return raw;
  const skip = new Set(["dubai", "united arab emirates", "uae"]);
  const meaningful = parts.filter((part) => !skip.has(part.toLowerCase()));
  if (!meaningful.length) return parts[0];
  return meaningful[meaningful.length - 1] || parts[0];
}

function DeliverSignInPrompt() {
  return (
    <AuthOpenButton mode="login" next="/checkout" className="deliver-signin-link">
      Sign in to set your address
    </AuthOpenButton>
  );
}

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
  const deliveryPromise = normalizeDeliveryPromise(pricing.data?.delivery_promise);
  const freeMinimum = Number(pricing.data?.free_delivery_minimum ?? 0);

  return (
    <div className="deliver-bar">
      <div className="header-inner deliver-row">
        <div className="deliver-location">
          <DeliverPinIcon />
          <span className="deliver-label deliver-label--desktop">Delivering to</span>
          {deliverTo && saved ? (
            <span className="deliver-label deliver-label--mobile">To</span>
          ) : null}
          {deliverTo && saved ? (
            <Link href="/checkout" className="deliver-place">
              <span className="deliver-place-full">{deliverTo}</span>
              <span className="deliver-place-short">{deliverShortLabel(saved)}</span>
              <CaretDownIcon />
            </Link>
          ) : signedIn ? (
            <Link href="/addresses" className="deliver-place deliver-place--cta">
              Add your address
              <CaretDownIcon />
            </Link>
          ) : (
            <DeliverSignInPrompt />
          )}
        </div>
        {deliveryPromise || freeMinimum > 0 ? (
          <div className="deliver-promise">
            {deliveryPromise ? <span>{deliveryPromise}</span> : null}
            {freeMinimum > 0 ? <span className="deliver-free">Free over AED {freeMinimum.toFixed(0)}</span> : null}
          </div>
        ) : null}
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

export function SiteHeader({ signedIn, user }: { signedIn: boolean; user: AuthUser | null }) {
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
          <nav className="header-nav header-nav--desktop" aria-label="Account">
            <AccountMenu user={user} />
            <CartLink />
          </nav>
          <nav className="header-nav header-nav--mobile" aria-label="Account">
            <MobileAccountTrigger user={user} />
            <CartLink compact />
          </nav>
        </div>
      </div>
    </header>
  );
}
