import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

export type StaffProfile = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: "admin" | "member" | string;
  is_active: boolean;
};

export async function getStaffProfile(): Promise<StaffProfile | null> {
  const result = await apiFetch<StaffProfile>("/admin/me");
  if (result.ok && result.data) return result.data;
  const fallback = await apiFetch<StaffProfile>("/staff/me");
  if (!fallback.ok || !fallback.data) return null;
  return fallback.data;
}

export async function requireStaff(): Promise<StaffProfile> {
  const me = await getStaffProfile();
  if (!me) redirect("/login");
  return me;
}

export async function requireAdmin(): Promise<StaffProfile> {
  const me = await requireStaff();
  if (me.role !== "admin") redirect("/orders");
  return me;
}
