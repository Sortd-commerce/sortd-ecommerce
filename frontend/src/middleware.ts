import { NextResponse, type NextRequest } from "next/server";
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

export async function middleware(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!refresh || (access && !accessNeedsRefresh(access))) {
    return NextResponse.next();
  }

  let serviceToken: string;
  try {
    serviceToken = await getServiceToken();
  } catch {
    return NextResponse.next();
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
    return NextResponse.next();
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  const data = payload.data as { access?: string; refresh?: string } | undefined;
  const next = NextResponse.next();

  if (!response.ok || payload.status !== "success" || !data?.access || !data?.refresh) {
    if (response.status === 401) {
      next.cookies.delete(ACCESS_COOKIE);
      next.cookies.delete(REFRESH_COOKIE);
    }
    return next;
  }

  next.cookies.set(ACCESS_COOKIE, data.access, authCookieOptions(ACCESS_COOKIE_MAX_AGE));
  next.cookies.set(REFRESH_COOKIE, data.refresh, authCookieOptions(REFRESH_COOKIE_MAX_AGE));
  return next;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)"],
};
