import { unstable_cache } from "next/cache";
import { apiFetch } from "@/lib/api";
import type { CardProduct } from "@/components/catalog";
import type { PricingRules } from "@/lib/pricing";

type ProductList = { results: CardProduct[]; count: number };
type Category = { name: string; slug: string; image_url?: string | null };
type CatalogCount = { count: number };

export const fetchCategories = unstable_cache(
  async () => apiFetch<Category[]>("/categories", { auth: false, cache: "force-cache" }),
  ["storefront-categories"],
  { revalidate: 300 },
);

export const fetchProductCatalog = unstable_cache(
  async () => apiFetch<ProductList>("/products?page_size=100", { auth: false, cache: "force-cache" }),
  ["storefront-products"],
  { revalidate: 60 },
);

export const fetchCatalogCount = unstable_cache(
  async () => apiFetch<CatalogCount>("/products?page_size=1", { auth: false, cache: "force-cache" }),
  ["storefront-catalog-count"],
  { revalidate: 60 },
);

export const fetchPricingRules = unstable_cache(
  async () => apiFetch<PricingRules>("/pricing", { auth: false, cache: "force-cache" }),
  ["storefront-pricing"],
  { revalidate: 300 },
);
