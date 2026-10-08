import { decodeJwt } from "jose";

export const ACCESS_COOKIE = "sortd_access";
export const REFRESH_COOKIE = "sortd_refresh";

export const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function accessNeedsRefresh(token: string): boolean {
  try {
    const payload = decodeJwt(token);
    const exp = payload.exp;
    if (!exp) return true;
    return exp <= Math.floor(Date.now() / 1000) + 60;
  } catch {
    return true;
  }
}

export function apiBase(): string {
  return (process.env.API_BASE_URL || "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");
}
