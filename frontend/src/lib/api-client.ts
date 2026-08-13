const DEFAULT_API_BASE_URL = "http://localhost:3001/api/v1";

type QueryValue = string | number | boolean | null | undefined;

export class ApiClientError extends Error {
  readonly status: number;
  readonly details: unknown;

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

export async function apiGet<T>(
  path: string,
  options: {
    query?: Record<string, QueryValue>;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const url = new URL(`${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`);

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
    throw new ApiClientError(readErrorMessage(body, response.status), response.status, body);
  }

  return body as T;
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
