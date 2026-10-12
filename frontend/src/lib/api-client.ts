import type { UiMessage } from "@/i18n/messages";

const DEFAULT_API_BASE_URL = "/backend-api/api/v1";

type QueryValue = string | number | boolean | null | undefined;

export class ApiClientError extends Error {
  readonly status: number;
  readonly details: unknown;
  uiMessage?: UiMessage;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
  }
}

export function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

export function createApiUrl(path: string) {
  const endpoint = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const currentOrigin = typeof window === "undefined" ? "http://localhost:3000" : window.location.origin;
  return new URL(endpoint, currentOrigin);
}

export async function apiGet<T>(
  path: string,
  options: {
    query?: Record<string, QueryValue>;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const url = createApiUrl(path);

  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: options.signal,
  });

  const body = await parseResponseBody(response);
  if (!response.ok) {
    throw createResponseError(body, response.status);
  }

  return body as T;
}

export async function apiPost<T>(path: string, body: unknown, options: { signal?: AbortSignal } = {}): Promise<T> {
  const url = createApiUrl(path);
  const response = await fetch(url, {
    body: JSON.stringify(body),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: options.signal,
  });

  const responseBody = await parseResponseBody(response);
  if (!response.ok) {
    throw createResponseError(responseBody, response.status);
  }

  return responseBody as T;
}

export async function apiPut<T>(path: string, body: unknown, options: { signal?: AbortSignal } = {}): Promise<T> {
  const url = createApiUrl(path);
  const response = await fetch(url, {
    body: JSON.stringify(body),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "PUT",
    signal: options.signal,
  });

  const responseBody = await parseResponseBody(response);
  if (!response.ok) {
    throw createResponseError(responseBody, response.status);
  }

  return responseBody as T;
}

export async function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  const url = createApiUrl(path);
  const response = await fetch(url, {
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    method: "DELETE",
  });

  const responseBody = await parseResponseBody(response);
  if (!response.ok) {
    throw createResponseError(responseBody, response.status);
  }

  return responseBody as T;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text || null;
}

function readErrorMessage(body: unknown, status: number) {
  if (typeof body === "object" && body !== null && "message" in body) {
    const message = (body as { message?: unknown }).message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }

  if (typeof body === "string" && body.trim()) return body;
  return `API request failed with status ${status}`;
}

// Attach presentation metadata only when the server did not provide a message.
function createResponseError(body: unknown, status: number) {
  const error = new ApiClientError(readErrorMessage(body, status), status, body);
  const serverMessage = typeof body === "string" && body.trim()
    || typeof body === "object" && body !== null && "message" in body
      && (typeof (body as { message?: unknown }).message === "string" || Array.isArray((body as { message?: unknown }).message));
  if (!serverMessage) error.uiMessage = { kind: "ui-message", key: "common.apiRequestFailed", params: { status } };
  return error;
}
