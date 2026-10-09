import type { NextRequest } from "next/server";

const UNUSABLE_HOSTS = new Set(["0.0.0.0", "::", "[::]", "127.0.0.1"]);

function configuredOrigin(): string | null {
  const raw =
    process.env.STOREFRONT_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "";
  const trimmed = raw.trim().replace(/\/$/, "");
  return trimmed || null;
}

function hostFromRequest(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || request.headers.get("host")?.trim() || "";
  const hostname = host.split(":")[0]?.toLowerCase() || "";
  if (!hostname || UNUSABLE_HOSTS.has(hostname)) return null;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    request.nextUrl.protocol.replace(":", "") ||
    "https";
  return `${proto}://${host}`;
}

/** Public storefront origin for redirects (never 0.0.0.0). */
export function siteOriginFromRequest(request: NextRequest): string {
  const configured = configuredOrigin();
  if (configured) return configured;

  const fromHeaders = hostFromRequest(request);
  if (fromHeaders) return fromHeaders;

  let origin = request.nextUrl.origin;
  if (origin.includes("0.0.0.0")) {
    origin = origin.replace("0.0.0.0", "localhost");
  }
  return origin;
}

export function absoluteStorefrontUrl(request: NextRequest, pathname: string): URL {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(path, `${siteOriginFromRequest(request)}/`);
}
