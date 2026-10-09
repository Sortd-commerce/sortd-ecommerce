"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { apiFetch } from "@/lib/api";
import { clearAuthCookies, getRefreshToken, setAuthCookies } from "@/lib/auth";
import type { RemoteCart } from "@/lib/cart-store";
import type { PriceQuote, PricingRules } from "@/lib/pricing";
import { safeRedirectPath } from "@/lib/redirect";
import { normalizeDubaiMobile, validateSignupFields } from "@/lib/signup-validation";
import { unwrapVerificationToken } from "@/lib/verification";

type AuthPayload = {
  user: { id: number; email: string; first_name: string; last_name: string; phone: string };
  tokens: { access: string; refresh: string };
};

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const full_name = String(formData.get("full_name") || "");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phoneLocal = String(formData.get("phone_local") || "");
  const phoneFromHidden = String(formData.get("phone") || "");
  const phone = phoneLocal.trim() !== "" ? normalizeDubaiMobile(phoneLocal) : phoneFromHidden.trim();
  const validationError = validateSignupFields({ full_name, email, phone });
  if (validationError) return { ok: false, message: validationError };

  const result = await apiFetch("/auth/signup", {
    method: "POST",
    auth: false,
    body: {
      email,
      full_name: full_name.trim().replace(/\s+/g, " "),
      phone,
    },
  });
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, message: "Code sent.", email, purpose: "signup" };
}

export async function requestLoginCodeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const result = await apiFetch<{ sent: boolean; purpose?: "login" | "signup" }>("/auth/login/code", {
    method: "POST",
    auth: false,
    body: { email },
  });
  if (!result.ok) return { ok: false, message: result.message, email, code: result.code };
  const purpose = result.data?.purpose === "signup" ? "signup" : "login";
  return { ok: true, message: result.message, email, purpose };
}

export async function verifySignupCodeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const result = await apiFetch<AuthPayload>("/auth/signup/verify", {
    method: "POST",
    auth: false,
    body: {
      email,
      code: String(formData.get("code") || ""),
      device_id: String(formData.get("device_id") || ""),
    },
  });
  if (!result.ok || !result.data) return { ok: false, message: result.message, email, purpose: "signup" };
  await setAuthCookies(result.data.tokens.access, result.data.tokens.refresh);
  revalidatePath("/", "layout");
  const next = safeRedirectPath(String(formData.get("next") || ""));
  if (next && next !== "/") redirect(next);
  return {
    ok: true,
    message: "Account created.",
    firstName: result.data.user.first_name,
    email,
    purpose: "signup",
  };
}

export async function verifyLoginCodeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const result = await apiFetch<AuthPayload>("/auth/login/verify", {
    method: "POST",
    auth: false,
    body: {
      email,
      code: String(formData.get("code") || ""),
      device_id: String(formData.get("device_id") || ""),
    },
  });
  if (!result.ok || !result.data) return { ok: false, message: result.message, email, purpose: "login" };
  await setAuthCookies(result.data.tokens.access, result.data.tokens.refresh);
  revalidatePath("/", "layout");
  const next = safeRedirectPath(String(formData.get("next") || ""));
  if (next !== "/") redirect(next);
  return {
    ok: true,
    message: "Logged in.",
    firstName: result.data.user.first_name,
    email,
    purpose: "login",
  };
}

export async function resendCodeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const purpose = String(formData.get("purpose") || "signup") as "signup" | "login";
  const result = await apiFetch("/auth/resend-code", {
    method: "POST",
    auth: false,
    body: { email, purpose },
  });
  if (!result.ok) return { ok: false, message: result.message, email, purpose };
  return { ok: true, message: "New code sent.", email, purpose };
}

/** Staff/admin password login — storefront uses email codes instead. */
export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await apiFetch<AuthPayload>("/auth/login", {
    method: "POST",
    auth: false,
    body: {
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
      device_id: String(formData.get("device_id") || ""),
    },
  });
  if (!result.ok || !result.data) return { ok: false, message: result.message };
  await setAuthCookies(result.data.tokens.access, result.data.tokens.refresh);
  redirect(safeRedirectPath(String(formData.get("next") || "")));
}

export async function verifyEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await apiFetch<AuthPayload>("/auth/verify-email", {
    method: "POST",
    auth: false,
    body: { token: unwrapVerificationToken(String(formData.get("token") || "")), device_id: String(formData.get("device_id") || "") },
  });
  if (!result.ok || !result.data) return { ok: false, message: result.message };
  await setAuthCookies(result.data.tokens.access, result.data.tokens.refresh);
  redirect("/");
}

export async function logoutAction(formData?: FormData) {
  const refresh = await getRefreshToken();
  if (refresh) {
    try {
      await apiFetch("/auth/logout", { method: "POST", auth: false, body: { refresh } });
    } catch {
      // Cookie clear still signs the browser out.
    }
  }
  await clearAuthCookies();
  revalidatePath("/", "layout");
  const next = safeRedirectPath(String(formData?.get("next") || ""));
  redirect(next || "/");
}

export async function fetchCartAction(): Promise<{ ok: boolean; status: number; data?: RemoteCart }> {
  const result = await apiFetch<RemoteCart>("/cart");
  return { ok: result.ok, status: result.status, data: result.data };
}

export async function fetchPricingRulesAction(): Promise<{ ok: boolean; data?: PricingRules }> {
  const result = await apiFetch<PricingRules>("/pricing", { auth: false });
  return { ok: result.ok, data: result.data };
}

export async function previewCouponsAction(
  items: Array<{ variant_id: number; quantity: number }>,
): Promise<{ ok: boolean; data?: import("@/lib/pricing").CouponOffer[]; message?: string }> {
  const result = await apiFetch<import("@/lib/pricing").CouponOffer[]>("/pricing/coupons/preview", {
    method: "POST",
    body: { items, discount_code: null },
  });
  return { ok: result.ok, data: result.data, message: result.message };
}

export async function prepareStripePaymentAction(
  expectedTotal: string,
  discountCode?: string,
): Promise<{ ok: boolean; clientSecret?: string; paymentIntentId?: string; message?: string }> {
  const result = await apiFetch<{ client_secret: string; payment_intent_id: string }>("/payments/stripe/intent", {
    method: "POST",
    body: {
      expected_total: expectedTotal,
      discount_code: discountCode?.trim() || null,
    },
  });
  if (!result.ok || !result.data) {
    return { ok: false, message: result.message };
  }
  return {
    ok: true,
    clientSecret: result.data.client_secret,
    paymentIntentId: result.data.payment_intent_id,
  };
}

export async function startStripeCheckoutSessionAction(
  payload: CheckoutValidatePayload & { note: string; expected_total: string },
): Promise<{ ok: boolean; url?: string; message?: string }> {
  const result = await apiFetch<{ url: string; session_id: string }>("/payments/stripe/checkout-session", {
    method: "POST",
    body: {
      address_id: payload.address_id,
      delivery_date: payload.delivery_date,
      window_id: payload.window_id,
      window_source: payload.window_source,
      payment_method: payload.payment_method,
      discount_code: payload.discount_code?.trim() || null,
      expected_total: payload.expected_total,
      note: payload.note,
    },
  });
  if (!result.ok || !result.data?.url) {
    return { ok: false, message: result.message };
  }
  return { ok: true, url: result.data.url };
}

export async function completeStripeCheckoutAction(
  sessionId: string,
): Promise<{ ok: boolean; orderNumber?: string; message?: string }> {
  const result = await apiFetch<{ number: string }>("/payments/stripe/checkout-complete", {
    method: "POST",
    body: { session_id: sessionId },
  });
  if (!result.ok || !result.data) {
    return { ok: false, message: result.message };
  }
  return { ok: true, orderNumber: result.data.number };
}

export type CheckoutValidatePayload = {
  address_id: number;
  delivery_date: string;
  window_id: number;
  window_source: string;
  payment_method: string;
  discount_code?: string | null;
  expected_total?: string | null;
};

export async function validateCheckoutAction(
  payload: CheckoutValidatePayload,
): Promise<{ ok: boolean; data?: PriceQuote; message?: string }> {
  const result = await apiFetch<PriceQuote>("/orders/validate", {
    method: "POST",
    body: {
      address_id: payload.address_id,
      delivery_date: payload.delivery_date,
      window_id: payload.window_id,
      window_source: payload.window_source,
      payment_method: payload.payment_method,
      discount_code: payload.discount_code?.trim() || null,
      expected_total: payload.expected_total?.trim() || null,
    },
  });
  return { ok: result.ok, data: result.data, message: result.message };
}

export async function quoteCartAction(
  items: Array<{ variant_id: number; quantity: number }>,
  discountCode?: string,
): Promise<{ ok: boolean; data?: PriceQuote; message?: string }> {
  const result = await apiFetch<PriceQuote>("/pricing/quote", {
    method: "POST",
    body: {
      items,
      discount_code: discountCode?.trim() || null,
    },
  });
  return { ok: result.ok, data: result.data, message: result.message };
}

export async function fetchDefaultAddressAction(): Promise<{ ok: boolean; deliverTo?: string }> {
  const result = await apiFetch<
    Array<{ line1: string; city: string; formatted_address: string; is_default?: boolean }>
  >("/addresses");
  if (!result.ok || !result.data?.length) return { ok: false };
  const saved = result.data.find((row) => row.is_default) || result.data[0];
  const deliverTo = saved.line1 || saved.city || saved.formatted_address;
  return { ok: true, deliverTo };
}

export async function syncCartAction(
  items: Array<{ variant_id: number; quantity: number }>,
): Promise<{ ok: boolean; status: number; message: string; data?: RemoteCart; skipped?: number[] }> {
  const result = await apiFetch<RemoteCart>("/cart/sync", {
    method: "PUT",
    body: { items },
  });
  if (result.ok) revalidatePath("/cart");
  return {
    ok: result.ok,
    status: result.status,
    message: result.message,
    data: result.data,
    skipped: result.data?.skipped_variant_ids,
  };
}

export type PlaceOrderPayload = {
  address_id: number;
  delivery_date: string;
  window_id: number;
  window_source: string;
  note: string;
  expected_total: string;
  payment_method: string;
  discount_code: string | null;
  stripe_payment_intent_id?: string | null;
  cart_json?: string;
};

export async function placePaidOrderAction(
  payload: PlaceOrderPayload,
): Promise<{ ok: boolean; orderNumber?: string; message?: string }> {
  const rawCart = payload.cart_json?.trim() || "";
  if (rawCart) {
    try {
      const items = JSON.parse(rawCart) as Array<{ variant_id: number; quantity: number }>;
      const synced = await apiFetch("/cart/sync", { method: "PUT", body: { items } });
      if (!synced.ok) return { ok: false, message: synced.message };
    } catch {
      return { ok: false, message: "Something went wrong with your basket. Please try again." };
    }
  }
  const key = crypto.randomUUID();
  const result = await apiFetch<{ number: string }>(
    "/orders",
    {
      method: "POST",
      body: {
        address_id: payload.address_id,
        delivery_date: payload.delivery_date,
        window_id: payload.window_id,
        window_source: payload.window_source,
        note: payload.note,
        expected_total: payload.expected_total,
        payment_method: payload.payment_method,
        discount_code: payload.discount_code,
        stripe_payment_intent_id: payload.stripe_payment_intent_id || null,
      },
      headers: { "Idempotency-Key": key },
    },
  );
  if (!result.ok || !result.data) return { ok: false, message: result.message };
  return { ok: true, orderNumber: result.data.number };
}

export async function placeOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await placePaidOrderAction({
    address_id: Number(formData.get("address_id")),
    delivery_date: String(formData.get("delivery_date") || ""),
    window_id: Number(formData.get("window_id")),
    window_source: String(formData.get("window_source") || "weekly"),
    note: String(formData.get("note") || ""),
    expected_total: String(formData.get("expected_total") || ""),
    payment_method: String(formData.get("payment_method") || ""),
    discount_code: String(formData.get("discount_code") || "") || null,
    stripe_payment_intent_id: String(formData.get("stripe_payment_intent_id") || "") || null,
    cart_json: String(formData.get("cart_json") || ""),
  });
  if (!result.ok || !result.orderNumber) return { ok: false, message: result.message || "Order could not be placed." };
  redirect(`/orders/${result.orderNumber}?placed=1`);
}

export async function saveAddressAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const latitude = String(formData.get("latitude") || "").trim();
  const longitude = String(formData.get("longitude") || "").trim();
  const addressId = String(formData.get("address_id") || "").trim();
  const payload = {
    line1: String(formData.get("line1") || ""),
    line2: String(formData.get("line2") || ""),
    city: String(formData.get("city") || "Dubai"),
    region: String(formData.get("region") || ""),
    postal_code: String(formData.get("postal_code") || ""),
    country: "AE",
    formatted_address: String(formData.get("formatted_address") || formData.get("line1") || ""),
    place_id: String(formData.get("place_id") || ""),
    latitude: latitude || null,
    longitude: longitude || null,
    is_default: String(formData.get("is_default") || "") !== "false",
  };
  const result = addressId
    ? await apiFetch(`/addresses/${addressId}`, { method: "PATCH", body: payload })
    : await apiFetch("/addresses", { method: "POST", body: payload });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/checkout");
  revalidatePath("/addresses");
  revalidatePath("/", "layout");
  return { ok: true, message: addressId ? "Address updated." : "Address saved." };
}

type SavedAddress = {
  id: number;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postal_code?: string;
  country?: string;
  place_id?: string;
  formatted_address: string;
  latitude?: string | null;
  longitude?: string | null;
};

export async function setPrimaryAddressAction(addressId: number): Promise<ActionState> {
  const list = await apiFetch<SavedAddress[]>("/addresses");
  if (!list.ok || !list.data) return { ok: false, message: list.message };
  const row = list.data.find((item) => item.id === addressId);
  if (!row) return { ok: false, message: "Address not found." };
  const result = await apiFetch(`/addresses/${addressId}`, {
    method: "PATCH",
    body: {
      line1: row.line1,
      line2: row.line2 || "",
      city: row.city,
      region: row.region || "",
      postal_code: row.postal_code || "",
      country: row.country || "AE",
      place_id: row.place_id || "",
      formatted_address: row.formatted_address || row.line1,
      latitude: row.latitude || null,
      longitude: row.longitude || null,
      is_default: true,
    },
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/checkout");
  revalidatePath("/addresses");
  revalidatePath("/", "layout");
  return { ok: true, message: "Primary delivery address updated." };
}
