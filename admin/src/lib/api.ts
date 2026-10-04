import { getAccessToken } from "@/lib/auth";
import { getServiceToken } from "@/lib/service-token";

export type ApiResult<T> = {
  ok: boolean;
  status: number;
  message: string;
  data?: T;
};

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean; headers?: Record<string, string> } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    "X-Service-Token": await getServiceToken(),
    Accept: "application/json",
    ...(options.headers || {}),
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.auth !== false) {
    const access = await getAccessToken();
    if (access) headers.Authorization = `Bearer ${access}`;
  }

  const base = (process.env.API_BASE_URL || "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  return {
    ok: response.ok && payload.status === "success",
    status: response.status,
    message: apiMessage(payload),
    data: payload.data as T | undefined,
  };
}

export async function apiForm<T>(path: string, formData: FormData): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    "X-Service-Token": await getServiceToken(),
    Accept: "application/json",
  };
  const access = await getAccessToken();
  if (access) headers.Authorization = `Bearer ${access}`;
  const base = (process.env.API_BASE_URL || "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers,
    body: formData,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  return {
    ok: response.ok && payload.status === "success",
    status: response.status,
    message: apiMessage(payload),
    data: payload.data as T | undefined,
  };
}

function apiMessage(payload: { message?: string; errors?: Array<{ message?: string }> }) {
  return String(payload?.errors?.[0]?.message || payload?.message || "Request failed");
}
