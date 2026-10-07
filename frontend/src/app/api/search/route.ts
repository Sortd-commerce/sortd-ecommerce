import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";

export type SearchSuggestion = {
  kind: "product" | "category";
  label: string;
  slug: string;
  brand: string | null;
  image_url: string | null;
  category_slug?: string;
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  const limit = request.nextUrl.searchParams.get("limit") || "3";
  const result = await apiFetch<SearchSuggestion[]>(
    `/products/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`,
    { auth: false },
  );
  return NextResponse.json(result, { status: result.ok ? 200 : result.status || 500 });
}
