"use client";

import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { SearchSuggestion } from "@/app/api/search/route";
import { OptimizedImage } from "@/components/OptimizedImage";

export function SearchField({
  categoryCount,
}: {
  count?: number;
  hint?: string;
  categoryCount?: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("q") || "";
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(initial);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(initial);
  }, [initial]);

  useEffect(() => {
    if (params.get("focus") !== "search") return;
    inputRef.current?.focus({ preventScroll: false });
    setOpen(true);
  }, [params]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const value = query.trim();
    if (value.length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const response = await fetch(`/api/search?q=${encodeURIComponent(value)}&limit=3`);
        const payload = await response.json();
        if (payload.ok && Array.isArray(payload.data)) {
          setSuggestions(payload.data);
          setOpen(true);
        } else {
          setSuggestions([]);
        }
      });
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, []);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setOpen(false);
    router.push(`/?q=${encodeURIComponent(value)}`);
  }

  function closeAndNavigate() {
    setOpen(false);
  }

  return (
    <div className="search-wrap" ref={rootRef}>
      <form action="/" className="search-form" role="search" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="store-search">
          Search products
        </label>
        <MagnifyingGlass size={17} weight="regular" className="search-form-icon" aria-hidden />
        <input
          ref={inputRef}
          id="store-search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => suggestions.length && setOpen(true)}
          placeholder="Search nut butter, protein bars…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
        />
        {categoryCount ? <span className="sr-only">{categoryCount} categories available</span> : null}
      </form>

      {open && suggestions.length ? (
        <ul id={listId} role="listbox" className="search-suggestions">
          {suggestions.map((item) => {
            const href =
              item.kind === "product" ? `/products/${item.slug}` : `/?aisle=${encodeURIComponent(item.slug)}`;
            return (
              <li key={`${item.kind}-${item.slug}`} role="option" aria-selected={false}>
                <Link href={href} className="search-suggestion" onClick={closeAndNavigate}>
                  <span className="search-suggestion-thumb">
                    {item.image_url ? (
                      <OptimizedImage src={item.image_url} alt="" width={36} height={36} sizes="36px" className="object-cover" />
                    ) : (
                      <span>{item.label.slice(0, 1)}</span>
                    )}
                  </span>
                  <span className="search-suggestion-copy">
                    <strong>{item.label}</strong>
                    <small>{item.kind === "category" ? "Category" : item.brand || "Product"}</small>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
      {pending && query.trim().length >= 2 ? <span className="sr-only">Searching…</span> : null}
    </div>
  );
}
