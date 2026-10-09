import { cache } from "react";
import type { AuthUser } from "@/components/auth/AuthProvider";
import { apiFetch } from "@/lib/api";
import { hasAuthSession } from "@/lib/auth";

export const getStorefrontSession = cache(async () => {
  const signedIn = await hasAuthSession();
  if (!signedIn) {
    return { signedIn: false as const, user: null as AuthUser | null };
  }
  const profile = await apiFetch<AuthUser>("/profile");
  return {
    signedIn: true as const,
    user: profile.ok ? profile.data ?? null : null,
  };
});
