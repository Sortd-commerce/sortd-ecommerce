import { cookies } from "next/headers";

const ACCESS = "sortd_admin_access";
const REFRESH = "sortd_admin_refresh";

export async function setAuthCookies(access: string, refresh: string) {
  const jar = await cookies();
  jar.set(ACCESS, access, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 15,
  });
  jar.set(REFRESH, refresh, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(ACCESS);
  jar.delete(REFRESH);
}

export async function getAccessToken() {
  return (await cookies()).get(ACCESS)?.value;
}

export async function getRefreshToken() {
  return (await cookies()).get(REFRESH)?.value;
}
