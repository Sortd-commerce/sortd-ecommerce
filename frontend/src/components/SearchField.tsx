"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useSearchParams } from "next/navigation";

export function SearchField({ count, hint }: { count: number; hint: string }) {
  const params = useSearchParams();
  const q = params.get("q") || "";
  const placeholder = count
    ? `Search ${count} products${hint ? ` — ${hint}` : ""}`
    : "Search products";

  return (
    <form action="/" className="search-form" role="search">
      <label className="sr-only" htmlFor="store-search">
        Search products
      </label>
      <MagnifyingGlass size={18} weight="bold" aria-hidden />
      <input id="store-search" name="q" defaultValue={q} key={q} placeholder={placeholder} autoComplete="off" />
    </form>
  );
}
