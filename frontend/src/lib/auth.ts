import { decodeJwt } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { getServiceToken } from "@/lib/service-token";

const ACCESS = "sortd_access";
const REFRESH = "sortd_refresh";

const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function apiBase(): string {
  return (process.env.API_BASE_URL || "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");
}

function accessNeedsRefresh(token: string): boolean {
  try {
    const payload = decodeJwt(token);
    const exp = payload.exp;
    if (!exp) return true;
    return exp <= Math.floor(Date.now() / 1000) + 60;
  } catch {
    return true;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAuthTokensInternal(): Promise<boolean> {
  const jar = await cookies();
  const refresh = jar.get(REFRESH)?.value;
  if (!refresh) return false;

  let serviceToken: string;
  try {
    serviceToken = await getServiceToken();
  } catch {
    return false;
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
    return false;
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  const data = payload.data as { access?: string; refresh?: string } | undefined;
  if (!response.ok || payload.status !== "success" || !data?.access || !data?.refresh) {
    if (response.status === 401) {
      await clearAuthCookies();
    }
    return false;
  }

  await setAuthCookies(data.access, data.refresh);
  return true;
}

export async function refreshAuthTokens(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = refreshAuthTokensInternal().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function setAuthCookies(access: string, refresh: string) {
  const jar = await cookies();
  jar.set(ACCESS, access, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });
  jar.set(REFRESH, refresh, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(ACCESS);
  jar.delete(REFRESH);
}

export const getAccessToken = cache(async (): Promise<string | undefined> => {
  const jar = await cookies();
  const access = jar.get(ACCESS)?.value;
  if (access && !accessNeedsRefresh(access)) {
    return access;
  }

  const refreshed = await refreshAuthTokens();
  if (!refreshed) {
    return access && !accessNeedsRefresh(access) ? access : undefined;
  }

  const next = await cookies();
  return next.get(ACCESS)?.value;
});

export async function getRefreshToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(REFRESH)?.value;
}
