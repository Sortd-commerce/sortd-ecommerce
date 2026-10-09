import { cookies } from "next/headers";
import { cache } from "react";
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
  accessNeedsRefresh,
  apiBase,
  authCookieOptions,
} from "@/lib/auth-cookies";
import { getServiceToken } from "@/lib/service-token";

export async function setAuthCookies(access: string, refresh: string) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, access, authCookieOptions(ACCESS_COOKIE_MAX_AGE));
  jar.set(REFRESH_COOKIE, refresh, authCookieOptions(REFRESH_COOKIE_MAX_AGE));
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export const getAccessToken = cache(async (): Promise<string | undefined> => {
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;
  if (!access || accessNeedsRefresh(access)) {
    return undefined;
  }
  return access;
});

/** Access token for API calls; refreshes in-process when the cookie is near expiry (e.g. after Stripe redirect). */
export const resolveAccessToken = cache(async (): Promise<string | undefined> => {
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;
  if (access && !accessNeedsRefresh(access)) {
    return access;
  }

  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (!refresh) {
    return access && !accessNeedsRefresh(access) ? access : undefined;
  }

  let serviceToken: string;
  try {
    serviceToken = await getServiceToken();
  } catch {
    return undefined;
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase()}/auth/refresh`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Service-Token": serviceToken,
      },
      body: JSON.stringify({ refresh }),
      cache: "no-store",
    });
  } catch {
    return undefined;
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  const data = payload.data as { access?: string; refresh?: string } | undefined;
  if (!response.ok || payload.status !== "success" || !data?.access || !data?.refresh) {
    return undefined;
  }

  jar.set(ACCESS_COOKIE, data.access, authCookieOptions(ACCESS_COOKIE_MAX_AGE));
  jar.set(REFRESH_COOKIE, data.refresh, authCookieOptions(REFRESH_COOKIE_MAX_AGE));
  return data.access;
});

export const hasAuthSession = cache(async (): Promise<boolean> => {
  const jar = await cookies();
  if (jar.get(REFRESH_COOKIE)?.value) return true;
  const access = jar.get(ACCESS_COOKIE)?.value;
  return Boolean(access && !accessNeedsRefresh(access));
});

export async function getRefreshToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value;
}
