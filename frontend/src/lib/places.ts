"use server";

import { apiFetch } from "@/lib/api";

export type PlaceSuggestion = {
  place_id: string;
  label: string;
  latitude: string | null;
  longitude: string | null;
};

export type DeliveryCheck = {
  status: string;
  formatted_address: string;
  postal_code: string | null;
  place_id: string;
  latitude: string | null;
  longitude: string | null;
  serviceable: boolean;
  zone_id: number | null;
  zone_name: string | null;
};

export async function autocompletePlaces(query: string): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const result = await apiFetch<PlaceSuggestion[]>("/delivery/autocomplete", {
    method: "POST",
    auth: false,
    body: { q, country: "", limit: 8 },
  });
  return result.ok && result.data ? result.data : [];
}

export async function checkDeliveryPlace(input: {
  place_id?: string;
  latitude?: string;
  longitude?: string;
  address?: string;
}): Promise<{ ok: boolean; message: string; data?: DeliveryCheck }> {
  const body: Record<string, string> = {};
  if (input.place_id) body.place_id = input.place_id;
  if (input.latitude && input.longitude) {
    body.latitude = input.latitude;
    body.longitude = input.longitude;
  }
  if (input.address) body.address = input.address;
  const result = await apiFetch<DeliveryCheck>("/delivery/check", {
    method: "POST",
    auth: false,
    body,
  });
  if (!result.ok || !result.data) {
    return { ok: false, message: result.message || "Could not verify that address." };
  }
  return { ok: true, message: result.message, data: result.data };
}
