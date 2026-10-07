import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";

export async function POST(_request: Request, context: { params: Promise<{ number: string }> }) {
  const { number } = await context.params;
  const result = await apiFetch(`/orders/${number}/confirm-payment`, { method: "POST" });
  return NextResponse.json(result, { status: result.ok ? 200 : result.status || 400 });
}
