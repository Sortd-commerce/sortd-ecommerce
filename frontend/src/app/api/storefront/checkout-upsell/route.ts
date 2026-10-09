import { NextResponse } from "next/server";
import { fetchCheckoutUpsellProducts } from "@/lib/catalog";

export async function GET() {
  const result = await fetchCheckoutUpsellProducts();
  return NextResponse.json(
    {
      ok: result.ok,
      data: result.data?.results ?? [],
      message: result.message,
    },
    { status: result.ok ? 200 : result.status || 500 },
  );
}
