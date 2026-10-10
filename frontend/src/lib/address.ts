export const ADDRESS_LABELS = [
  { value: "home", title: "Home" },
  { value: "work", title: "Work" },
  { value: "other", title: "Other", isDefault: true },
] as const;

export type AddressLabelValue = (typeof ADDRESS_LABELS)[number]["value"];

export type DeliveryAddress = {
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
  is_default?: boolean;
  label?: string;
  community?: string;
  building?: string;
  unit?: string;
  floor?: string;
};

export function formatAddressLabel(label?: string | null) {
  const match = ADDRESS_LABELS.find((row) => row.value === (label || "other").toLowerCase());
  return match?.title || "Other";
}

export function formatAddressDetails(address: {
  building?: string;
  unit?: string;
  floor?: string;
  community?: string;
  formatted_address?: string;
  line1?: string;
  city?: string;
}) {
  const local = [address.building, address.unit, address.floor ? `Floor ${address.floor}` : "", address.community]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(", ");
  const geo = address.formatted_address || [address.line1, address.city].filter(Boolean).join(", ");
  return local && geo && !geo.toLowerCase().includes(local.toLowerCase()) ? `${local} · ${geo}` : local || geo;
}
