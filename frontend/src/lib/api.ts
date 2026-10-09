/**
 * Typed HTTP client.
 *
 * One place that knows about base URLs, auth headers, JSON parsing and error
 * shape. Feature modules call `api.get` / `api.post` and never touch fetch.
 * The access token lives in memory only; the refresh token is an httpOnly
 * cookie the browser sends on its own, which is why `credentials` is always
 * included.
 */

import { config } from "./config";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isNetworkFailure(): boolean {
    return this.status === 0;
  }
}

/** In-memory access token. Never written to localStorage. */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Told when the session cannot be renewed, so the app can sign out. */
let onSessionLost: (() => void) | null = null;

export function setSessionLostHandler(handler: (() => void) | null): void {
  onSessionLost = handler;
}

let refreshing: Promise<string | null> | null = null;

/**
 * Trade the refresh cookie for a new access token. Single-flight: the
 * server rotates the cookie on every use, so two refreshes racing with the
 * same cookie would leave one of them rejected. Every caller waiting at the
 * same moment shares one request instead. Resolves to null when the session
 * is gone.
 */
export function refreshAccessToken(): Promise<string | null> {
  refreshing ??= request<{ access_token: string }>("POST", "/auth/refresh", undefined, {
    noRetry: true,
  })
    .then((res) => {
      accessToken = res.access_token;
      return res.access_token;
    })
    .catch((error: unknown) => {
      // A transport failure says nothing about the session; keep it.
      if (error instanceof ApiError && error.isNetworkFailure) throw error;
      accessToken = null;
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

type RequestOptions = {
  /** Skip the /api/v1 prefix, for routes like /health that sit at the root. */
  absolutePath?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Internal: do not renew the access token and retry on a 401. */
  noRetry?: boolean;
};

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const prefix = options.absolutePath ? "" : config.apiPrefix;
  const url = `${config.apiUrl}${prefix}${path}`;

  const headers: Record<string, string> = { ...options.headers };
  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      credentials: "include",
      signal: options.signal,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    });
  } catch (cause) {
    // fetch only rejects on a transport failure, so this is "server unreachable".
    throw new ApiError(0, "Cannot reach the server. Is the backend running?", cause);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? safeJson(text) : null;

  // The access token lasts thirty minutes; renew it once and retry rather
  // than failing every call in a tab that has been open longer than that.
  if (response.status === 401 && !options.noRetry && !path.startsWith("/auth/")) {
    const renewed = await refreshAccessToken().catch(() => null);
    if (renewed) return request<T>(method, path, body, { ...options, noRetry: true });
    if (accessToken === null) onSessionLost?.();
  }

  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(payload, response.statusText), payload);
  }

  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** FastAPI puts the useful message in `detail`, which may be a string or a list. */
function extractMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload) return payload;
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      if (first?.msg) return first.msg;
    }
  }
  return fallback || "Request failed";
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, undefined, options),
};
