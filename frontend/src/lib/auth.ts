import { cookies } from "next/headers";
import { cache } from "react";
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
  accessNeedsRefresh,
  authCookieOptions,
} from "@/lib/auth-cookies";

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
