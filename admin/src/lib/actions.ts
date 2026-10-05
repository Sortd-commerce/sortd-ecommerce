"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { apiFetch, apiForm } from "@/lib/api";
import { clearAuthCookies, getRefreshToken, setAuthCookies } from "@/lib/auth";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function replied(ok: boolean, message: string, path?: string): ActionState {
  if (path) revalidatePath(path);
  return { ok, message };
}

function pipeRows(text: string, keys: string[]) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      const row: Record<string, string> = {};
      keys.forEach((key, index) => {
        row[key] = parts[index] || "";
      });
      return row;
    });
}

function labelFromForm(formData: FormData) {
  return {
    serving_basis: String(formData.get("serving_basis") || ""),
    serving_size: String(formData.get("serving_size") || ""),
    headline: String(formData.get("headline") || ""),
    note: String(formData.get("label_note") || ""),
    guidance: String(formData.get("guidance") || ""),
    nutritionist_note: String(formData.get("nutritionist_note") || ""),
    sugar_source: String(formData.get("sugar_source") || ""),
    hidden_sugars_found: Number(formData.get("hidden_sugars_found") || 0),
    banned_ingredients_found: Number(formData.get("banned_ingredients_found") || 0),
    shares_printed: formData.get("shares_printed") === "on",
    facts: pipeRows(String(formData.get("facts") || ""), [
      "name",
      "amount",
      "unit",
      "level",
      "note",
      "group",
      "is_subfact",
    ]).map((row) => ({
      ...row,
      is_highlight: ["Energy", "Protein", "Carbohydrate", "Fat"].includes(row.name),
      is_subfact: row.is_subfact === "1" || row.is_subfact === "sub",
    })),
    ingredients: pipeRows(String(formData.get("ingredients") || ""), ["name", "share_percent", "detail"]).map((row) => ({
      name: row.name,
      share_percent: Number.isFinite(Number(row.share_percent)) ? Number(row.share_percent) : null,
      detail: row.detail,
    })),
    allergens: pipeRows(String(formData.get("allergens") || ""), ["name", "detail"]),
  };
}

function offersFromForm(formData: FormData) {
  const offers = [];
  for (const index of [1, 2, 3]) {
    const sku = String(formData.get(`offer_sku_${index}`) || "").trim();
    if (!sku) continue;
    offers.push({
      sku,
      title: String(formData.get(`offer_title_${index}`) || "Default"),
      price: String(formData.get(`offer_price_${index}`) || "0"),
      compare_at_price: String(formData.get(`offer_compare_${index}`) || "") || null,
      unit_count: Number(formData.get(`offer_units_${index}`) || 1),
      on_hand: Number(formData.get(`offer_stock_${index}`) || 0),
    });
  }
  return offers;
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await apiFetch<{ tokens: { access: string; refresh: string }; user: { email: string } }>(
    "/auth/login",
    {
      method: "POST",
      auth: false,
      body: {
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
        device_id: String(formData.get("device_id") || ""),
      },
    },
  );
  if (!result.ok || !result.data) return { ok: false, message: result.message };
  await setAuthCookies(result.data.tokens.access, result.data.tokens.refresh);
  const me = await apiFetch<{ role: string }>("/admin/me", {
    headers: { Authorization: `Bearer ${result.data.tokens.access}` },
  });
  if (!me.ok || !me.data) {
    await clearAuthCookies();
    return { ok: false, message: "Staff credentials are required." };
  }
  redirect(me.data.role === "admin" ? "/" : "/orders");
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

export async function createProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const offers = offersFromForm(formData);
  const related = formData.getAll("related_slugs").map(String).filter(Boolean);
  const body: Record<string, unknown> = {
    title: String(formData.get("title") || ""),
    category_id: Number(formData.get("category_id")),
    status: String(formData.get("status") || "draft"),
    description: String(formData.get("description") || ""),
    related_slugs: related,
    related_kind: "flavor",
    label: labelFromForm(formData),
  };
  if (offers.length) {
    body.variants = offers;
  } else {
    body.variant_sku = String(formData.get("variant_sku") || "");
    body.variant_title = String(formData.get("variant_title") || "Default");
    body.price = String(formData.get("price") || "0");
    body.on_hand = Number(formData.get("on_hand") || 0);
  }
  const result = await apiFetch<{ id: number }>("/admin/products", { method: "POST", body });
  if (!result.ok || !result.data) return { ok: false, message: result.message };
  const productId = result.data.id;
  const files = formData.getAll("images");
  for (const file of files) {
    if (!(file instanceof File) || !file.size) continue;
    const out = new FormData();
    out.append("file", file);
    out.append("alt", String(formData.get("title") || ""));
    const uploaded = await apiForm(`/admin/products/${productId}/images`, out);
    if (!uploaded.ok) return { ok: false, message: uploaded.message };
  }
  redirect(`/products/${productId}`);
}

export async function updateOrderStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const number = String(formData.get("number") || "");
  const result = await apiFetch(`/admin/orders/${number}`, {
    method: "PATCH",
    body: { status: String(formData.get("status") || "") },
  });
  if (!result.ok) return replied(false, result.message);
  return replied(true, "Order status updated.", `/orders/${number}`);
}

function clock(value: string) {
  const raw = String(value || "").trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  return raw;
}

export async function createWindowAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await apiFetch("/admin/delivery/windows", {
    method: "POST",
    body: {
      weekday: Number(formData.get("weekday")),
      start_time: clock(String(formData.get("start_time") || "")),
      end_time: clock(String(formData.get("end_time") || "")),
      capacity: Number(formData.get("capacity") || 1),
      cutoff_minutes: Number(formData.get("cutoff_minutes") || 60),
      is_active: formData.get("is_active") === "on",
    },
  });
  if (!result.ok) return replied(false, result.message);
  return replied(true, "Delivery window added.", "/delivery");
}

export async function updateWindowAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const windowId = String(formData.get("window_id") || "");
  const result = await apiFetch(`/admin/delivery/windows/${windowId}`, {
    method: "PATCH",
    body: {
      weekday: Number(formData.get("weekday")),
      start_time: clock(String(formData.get("start_time") || "")),
      end_time: clock(String(formData.get("end_time") || "")),
      capacity: Number(formData.get("capacity") || 1),
      cutoff_minutes: Number(formData.get("cutoff_minutes") || 60),
      is_active: formData.get("is_active") === "on",
    },
  });
  if (!result.ok) return replied(false, result.message);
  return replied(true, "Delivery window updated.", "/delivery");
}

export async function deleteWindowAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const windowId = String(formData.get("window_id") || "");
  const result = await apiFetch(`/admin/delivery/windows/${windowId}`, { method: "DELETE" });
  if (!result.ok) return replied(false, result.message);
  return replied(true, "Delivery window removed.", "/delivery");
}

export async function createPostalCodeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await apiFetch("/admin/delivery/postal-codes", {
    method: "POST",
    body: {
      code: String(formData.get("code") || ""),
      is_active: formData.get("is_active") === "on",
    },
  });
  if (!result.ok) return replied(false, result.message);
  return replied(true, "Postal code added.", "/delivery");
}

export async function updatePostalCodeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const codeId = String(formData.get("code_id") || "");
  const result = await apiFetch(`/admin/delivery/postal-codes/${codeId}`, {
    method: "PATCH",
    body: {
      code: String(formData.get("code") || ""),
      is_active: formData.get("is_active") === "on",
    },
  });
  if (!result.ok) return replied(false, result.message);
  return replied(true, "Postal code updated.", "/delivery");
}

export async function deletePostalCodeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const codeId = String(formData.get("code_id") || "");
  const result = await apiFetch(`/admin/delivery/postal-codes/${codeId}`, { method: "DELETE" });
  if (!result.ok) return replied(false, result.message);
  return replied(true, "Postal code removed.", "/delivery");
}

export async function createMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await apiFetch("/admin/members", {
    method: "POST",
    body: {
      email: String(formData.get("email") || ""),
      first_name: String(formData.get("first_name") || ""),
      last_name: String(formData.get("last_name") || ""),
      password: String(formData.get("password") || ""),
      role: String(formData.get("role") || "member"),
    },
  });
  if (!result.ok) return replied(false, result.message);
  return replied(true, "Member added.", "/members");
}

export async function updateMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = String(formData.get("user_id") || "");
  const result = await apiFetch(`/admin/members/${userId}`, {
    method: "PATCH",
    body: { role: String(formData.get("role") || "") },
  });
  if (!result.ok) return replied(false, result.message);
  return replied(true, "Member updated.", "/members");
}

export async function removeMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = String(formData.get("user_id") || "");
  const result = await apiFetch(`/admin/members/${userId}`, { method: "DELETE" });
  if (!result.ok) return replied(false, result.message);
  return replied(true, "Member removed.", "/members");
}

export async function createCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await apiFetch("/admin/categories", {
    method: "POST",
    body: {
      name: String(formData.get("name") || ""),
      is_active: true,
    },
  });
  if (!result.ok) return replied(false, result.message);
  return replied(true, "Category created.", "/products/new");
}

export async function setStockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const variantId = String(formData.get("variant_id") || "");
  const productId = String(formData.get("product_id") || "");
  const result = await apiFetch(`/admin/variants/${variantId}/stock`, {
    method: "POST",
    body: { on_hand: Number(formData.get("on_hand") || 0) },
  });
  if (!result.ok) return replied(false, result.message);
  return replied(true, "Stock updated.", `/products/${productId}`);
}

export async function updateProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const productId = String(formData.get("product_id") || "");
  const related = formData.getAll("related_slugs").map(String).filter(Boolean);
  const result = await apiFetch(`/admin/products/${productId}`, {
    method: "PATCH",
    body: {
      title: String(formData.get("title") || ""),
      description: String(formData.get("description") || ""),
      status: String(formData.get("status") || "draft"),
      category_id: Number(formData.get("category_id")),
      related_slugs: related,
      related_kind: "flavor",
      label: labelFromForm(formData),
    },
  });
  if (!result.ok) return replied(false, result.message);
  return replied(true, "Product saved.", `/products/${productId}`);
}

export async function updateOfferAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const productId = String(formData.get("product_id") || "");
  const variantId = String(formData.get("variant_id") || "");
  const compare = String(formData.get("compare_at_price") || "").trim();
  const result = await apiFetch(`/admin/variants/${variantId}`, {
    method: "PATCH",
    body: {
      title: String(formData.get("title") || ""),
      price: String(formData.get("price") || "0"),
      compare_at_price: compare || null,
      unit_count: Number(formData.get("unit_count") || 1),
      is_active: formData.get("is_active") === "on",
    },
  });
  if (!result.ok) return replied(false, result.message);
  const stock = await apiFetch(`/admin/variants/${variantId}/stock`, {
    method: "POST",
    body: { on_hand: Number(formData.get("on_hand") || 0) },
  });
  if (!stock.ok) return replied(false, stock.message);
  return replied(true, "Offer saved.", `/products/${productId}`);
}

export async function addOfferAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const productId = String(formData.get("product_id") || "");
  const result = await apiFetch(`/admin/products/${productId}/variants`, {
    method: "POST",
    body: {
      sku: String(formData.get("sku") || ""),
      title: String(formData.get("title") || "Default"),
      price: String(formData.get("price") || "0"),
      compare_at_price: String(formData.get("compare_at_price") || "") || null,
      unit_count: Number(formData.get("unit_count") || 1),
      on_hand: Number(formData.get("on_hand") || 0),
    },
  });
  if (!result.ok) return replied(false, result.message);
  return replied(true, "Offer added.", `/products/${productId}`);
}

export async function uploadProductImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const productId = String(formData.get("product_id") || "");
  const files = formData.getAll("files").filter((file): file is File => file instanceof File && file.size > 0);
  if (!files.length) return replied(false, "Choose one or more images to upload.");
  for (const file of files) {
    const out = new FormData();
    out.append("file", file);
    out.append("alt", String(formData.get("alt") || file.name));
    const result = await apiForm(`/admin/products/${productId}/images`, out);
    if (!result.ok) return replied(false, result.message);
  }
  return replied(true, files.length === 1 ? "Image uploaded." : `${files.length} images uploaded.`, `/products/${productId}`);
}

export async function reorderProductImagesAction(productId: number, imageIds: number[]) {
  const result = await apiFetch(`/admin/products/${productId}/images/order`, {
    method: "PATCH",
    body: { image_ids: imageIds },
  });
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true };
}

export async function makePrimaryImageAction(formData: FormData) {
  const productId = String(formData.get("product_id") || "");
  const imageId = String(formData.get("image_id") || "");
  const result = await apiFetch(`/admin/products/${productId}/images/${imageId}/first`, { method: "POST" });
  if (!result.ok) fail(`/products/${productId}`, result.message);
  redirect(`/products/${productId}`);
}

export async function deleteProductImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const productId = String(formData.get("product_id") || "");
  const imageId = String(formData.get("image_id") || "");
  const result = await apiFetch(`/admin/products/${productId}/images/${imageId}`, { method: "DELETE" });
  if (!result.ok) return replied(false, result.message);
  return replied(true, "Image removed.", `/products/${productId}`);
}


