import { getAccessToken } from "@/lib/auth";
import { getServiceToken } from "@/lib/service-token";

type ApiOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
  cache?: RequestCache;
  revalidate?: number | false;
};

export type ApiResult<T> = {
  ok: boolean;
  status: number;
  message: string;
  data?: T;
  code?: string;
  errors?: Array<{ field?: string; message: string }>;
};

function apiBase(): string {
  return (process.env.API_BASE_URL || "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<ApiResult<T>> {
  const serviceToken = await getServiceToken();
  const headers: Record<string, string> = {
    "X-Service-Token": serviceToken,
    Accept: "application/json",
    ...(options.headers || {}),
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.auth !== false) {
    const access = await getAccessToken();
    if (access) {
      headers.Authorization = `Bearer ${access}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: options.cache || "no-store",
      ...(options.revalidate !== undefined ? { next: { revalidate: options.revalidate } } : {}),
    });
  } catch {
    return {
      ok: false,
      status: 0,
      message: "The store is unreachable right now.",
    };
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  return {
    ok: response.ok && payload.status === "success",
    status: response.status,
    message: String(
      (payload.errors as Array<{ message?: string }> | undefined)?.[0]?.message ||
        payload.message ||
        (response.ok ? "OK" : "Request failed"),
    ),
    data: payload.data as T | undefined,
    code: payload.code ? String(payload.code) : undefined,
    errors: (payload.errors as ApiResult<T>["errors"]) || [],
  };
}
