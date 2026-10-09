import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";
import { absoluteStorefrontUrl } from "@/lib/site-origin";

const PAYMENT_PENDING = /payment has not completed/i;

async function completeCheckout(sessionId: string) {
  return apiFetch<{ number: string }>("/payments/stripe/checkout-complete", {
    method: "POST",
    body: { session_id: sessionId },
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.redirect(absoluteStorefrontUrl(request, "/checkout"));
  }

  let result = await completeCheckout(sessionId);
  for (let attempt = 0; attempt < 4 && !result.ok && PAYMENT_PENDING.test(result.message); attempt += 1) {
    await wait(400);
    result = await completeCheckout(sessionId);
  }

  if (result.ok && result.data?.number) {
    const success = absoluteStorefrontUrl(request, `/orders/${result.data.number}`);
    success.searchParams.set("placed", "1");
    return NextResponse.redirect(success);
  }

  const fallback = absoluteStorefrontUrl(request, "/checkout");
  fallback.searchParams.set("payment_error", "1");
  return NextResponse.redirect(fallback);
}
