import { getAccessToken } from "@/lib/auth";
import { getServiceToken } from "@/lib/service-token";

export type ApiResult<T> = {
  ok: boolean;
  status: number;
  message: string;
  data?: T;
};

function apiMessage(payload: { message?: string; errors?: Array<{ message?: string }> }) {
  return String(payload?.errors?.[0]?.message || payload?.message || "").trim();
}

function friendlyApiMessage(status: number, parsed: string) {
  if (parsed && parsed !== "Request failed") return parsed;
  if (status === 0) {
    return "Could not reach the Sortd API. Make sure the Django server is running on port 8000.";
  }
  if (status === 401) return "Your session expired. Sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) {
    return "The Sortd API endpoint was not found. Restart the Django server and confirm API_BASE_URL includes /api/v1.";
  }
  if (status === 409) return "That action conflicted with a recent change. Refresh and try again.";
  if (status === 422) return "Some of the submitted data was invalid.";
  if (status >= 500) return "The Sortd API is temporarily unavailable. Try again in a moment.";
  return "Something went wrong. Try again.";
}

function envelope<T>(
  response: Response,
  payload: { status?: string; message?: string; errors?: Array<{ message?: string }>; data?: T },
): ApiResult<T> {
  const parsed = apiMessage(payload);
  const ok = response.ok && payload.status === "success";
  return {
    ok,
    status: response.status,
    message: ok ? parsed || "OK" : friendlyApiMessage(response.status, parsed),
    data: payload.data as T | undefined,
  };
}

async function request<T>(
  url: string,
  init: RequestInit,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: "no-store" });
  } catch {
    return {
      ok: false,
      status: 0,
      message: friendlyApiMessage(0, ""),
    };
  }

  const payload = await response.json().catch(() => ({}));
  return envelope(response, payload);
}

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
  return request<T>(`${base}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

export async function apiForm<T>(path: string, formData: FormData): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    "X-Service-Token": await getServiceToken(),
    Accept: "application/json",
  };
  const access = await getAccessToken();
  if (access) headers.Authorization = `Bearer ${access}`;

  const base = (process.env.API_BASE_URL || "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");
  return request<T>(`${base}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });
}
