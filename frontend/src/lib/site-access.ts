import { jwtVerify } from "jose";

export const SITE_ACCESS_COOKIE = "sortd_site_access";
export const SITE_ACCESS_MAX_AGE = 60 * 60 * 24 * 14;

export function isSitePasswordGateEnabled(): boolean {
  return process.env.STOREFRONT_PASSWORD_GATE_ENABLED?.trim().toLowerCase() === "true";
}

export function siteAccessCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function isValidSiteAccessToken(token: string): Promise<boolean> {
  const signingKey = process.env.SERVICE_SIGNING_KEY;
  if (!signingKey) return false;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(signingKey), {
      algorithms: ["HS256"],
      issuer: "sortd-api",
      audience: "sortd-storefront",
    });
    return payload.token_use === "site_access";
  } catch {
    return false;
  }
}
