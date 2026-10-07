import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";

type OrdersPage = {
  results: Array<{ status: string }>;
};

const ACTIVE = new Set(["placed", "confirmed", "out_for_delivery"]);

export async function GET() {
  const orders = await apiFetch<OrdersPage>("/orders?page_size=50");
  if (!orders.ok) {
    return NextResponse.json({ active_count: 0 }, { status: orders.status === 401 ? 401 : 200 });
  }
  const active_count = (orders.data?.results || []).filter((row) => ACTIVE.has(row.status)).length;
  return NextResponse.json({ active_count });
}
