import { Suspense } from "react";
import Link from "next/link";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { AuthOpenButton } from "@/components/auth/AuthOpenButton";
import type { AuthUser } from "@/components/auth/AuthProvider";
import { BrandMark } from "@/components/BrandMark";
import { CartLink } from "@/components/CartLink";
import { DirhamIcon } from "@/components/DirhamIcon";
import { MobileAccountTrigger } from "@/components/MobileAccountTrigger";
import { DeliverAddressMenu, type DeliverAddress } from "@/components/DeliverAddressMenu";
import { CaretDownIcon, DeliverPinIcon } from "@/components/HeaderIcons";
import { SearchField } from "@/components/SearchField";
import { DeliverBarSkeleton, SearchFormSkeleton } from "@/components/loading/StorefrontSkeletons";
import { fetchCatalogCount, fetchCategories, fetchPricingRules } from "@/lib/catalog";
import { normalizeDeliveryPromise } from "@/lib/pricing";
import { apiFetch } from "@/lib/api";

type Address = DeliverAddress;

function DeliverSignInPrompt() {
  return (
    <AuthOpenButton mode="login" next="/addresses" className="deliver-signin-link">
      Sign in to set your address
    </AuthOpenButton>
  );
}

async function DeliverBar({ signedIn }: { signedIn: boolean }) {
  const [addresses, pricing] = await Promise.all([
    signedIn ? apiFetch<Address[]>("/addresses") : Promise.resolve(null),
    fetchPricingRules(),
  ]);
  const savedList = signedIn && addresses?.ok ? addresses.data || [] : [];
  const deliveryPromise = normalizeDeliveryPromise(pricing.data?.delivery_promise);
  const freeMinimum = Number(pricing.data?.free_delivery_minimum ?? 0);

  return (
    <div className="deliver-bar">
      <div className="header-inner deliver-row">
        <div className="deliver-location">
          <DeliverPinIcon />
          <span className="deliver-label deliver-label--desktop">Delivering to</span>
          <span className="deliver-label deliver-label--mobile">To</span>
          {savedList.length ? (
            <DeliverAddressMenu addresses={savedList} />
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
            {freeMinimum > 0 ? <span className="deliver-free">Free over <DirhamIcon /> {freeMinimum.toFixed(0)}</span> : null}
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
