"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { apiFetch } from "@/lib/api";
import { clearAuthCookies, getRefreshToken, setAuthCookies } from "@/lib/auth";
import type { RemoteCart } from "@/lib/cart-store";
import { unwrapVerificationToken } from "@/lib/verification";

type AuthPayload = {
  user: { id: number; email: string; first_name: string; last_name: string; phone: string };
  tokens: { access: string; refresh: string };
};

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "");
  const result = await apiFetch("/auth/signup", {
    method: "POST",
    auth: false,
    body: {
      email,
      password: String(formData.get("password") || ""),
      first_name: String(formData.get("first_name") || ""),
      last_name: String(formData.get("last_name") || ""),
      phone: String(formData.get("phone") || ""),
    },
  });
  if (!result.ok) return { ok: false, message: result.message };
  redirect(`/verify-email?email=${encodeURIComponent(email)}`);
}

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
  redirect("/");
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

export async function resendVerificationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  const result = await apiFetch("/auth/resend-verification", {
    method: "POST",
    auth: false,
    body: { email },
  });
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, message: "If that account still needs verifying, we sent a new link." };
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await apiFetch("/auth/forgot-password", {
    method: "POST",
    auth: false,
    body: { email: String(formData.get("email") || "").trim() },
  });
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, message: "If that account exists, we sent a reset link." };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await apiFetch("/auth/reset-password", {
    method: "POST",
    auth: false,
    body: {
      token: unwrapVerificationToken(String(formData.get("token") || "")),
      password: String(formData.get("password") || ""),
    },
  });
  if (!result.ok) return { ok: false, message: result.message };
  redirect("/login");
}

export async function logoutAction() {
  const refresh = await getRefreshToken();
  if (refresh) {
    try {
      await apiFetch("/auth/logout", { method: "POST", auth: false, body: { refresh } });
    } catch {
      // Cookie clear still signs the browser out.
    }
  }
  await clearAuthCookies();
  redirect("/login");
}

export async function fetchCartAction(): Promise<{ ok: boolean; status: number; data?: RemoteCart }> {
  const result = await apiFetch<RemoteCart>("/cart");
  return { ok: result.ok, status: result.status, data: result.data };
}

export async function syncCartAction(
  items: Array<{ variant_id: number; quantity: number }>,
): Promise<{ ok: boolean; status: number; message: string; data?: RemoteCart }> {
  const result = await apiFetch<RemoteCart>("/cart/sync", {
    method: "PUT",
    body: { items },
  });
  if (result.ok) revalidatePath("/cart");
  return { ok: result.ok, status: result.status, message: result.message, data: result.data };
}

export async function placeOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const rawCart = String(formData.get("cart_json") || "").trim();
  if (rawCart) {
    try {
      const items = JSON.parse(rawCart) as Array<{ variant_id: number; quantity: number }>;
      const synced = await apiFetch("/cart/sync", { method: "PUT", body: { items } });
      if (!synced.ok) return { ok: false, message: synced.message };
    } catch {
      return { ok: false, message: "Cart could not be synced. Refresh and try again." };
    }
  }
  const payload = {
    address_id: Number(formData.get("address_id")),
    delivery_date: String(formData.get("delivery_date") || ""),
    window_id: Number(formData.get("window_id")),
    window_source: String(formData.get("window_source") || "weekly"),
    note: String(formData.get("note") || ""),
    expected_total: String(formData.get("expected_total") || ""),
    payment_method: String(formData.get("payment_method") || ""),
    discount_code: String(formData.get("discount_code") || "") || null,
  };
  const key = crypto.randomUUID();
  const result = await apiFetch("/orders", {
    method: "POST",
    body: payload,
    headers: { "Idempotency-Key": key },
  });
  if (!result.ok || !result.data) return { ok: false, message: result.message };
  const number = (result.data as { number: string }).number;
  redirect(`/orders/${number}`);
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
  return { ok: true, message: addressId ? "Address updated." : "Address saved." };
}
