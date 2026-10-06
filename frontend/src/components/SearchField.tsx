"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useSearchParams } from "next/navigation";

export function SearchField({
  count,
  categoryCount,
}: {
  count: number;
  hint?: string;
  categoryCount?: number;
}) {
  const params = useSearchParams();
  const q = params.get("q") || "";
  const placeholder = count ? `Search ${count} products…` : "Search products…";

  return (
    <form action="/" className="search-form" role="search">
      <label className="sr-only" htmlFor="store-search">
        Search products
      </label>
      <MagnifyingGlass size={17} weight="regular" className="search-form-icon" aria-hidden />
      <input id="store-search" name="q" defaultValue={q} key={q} placeholder={placeholder} autoComplete="off" />
      {categoryCount ? <span className="sr-only">{categoryCount} categories available</span> : null}
    </form>
  );
}
