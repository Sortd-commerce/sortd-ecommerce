import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";

export async function GET() {
  const result = await apiFetch<{ publishable_key: string }>("/payments/stripe/config", { auth: false });
  if (!result.ok || !result.data?.publishable_key) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status || 404 });
  }
  return NextResponse.json({ ok: true, publishable_key: result.data.publishable_key });
}
