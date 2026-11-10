// Central HTTP configuration. Orval-generated fetchers (src/api/generated) use
// apiFetch as their mutator, so error handling stays in one place. Generated
// URLs already include the /api prefix from the backend's OpenAPI document.

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// Orval types the TError of generated hooks with this. The parameter carries
// the documented error body type, which apiFetch exposes as ApiError.body.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ErrorType<_Error> = ApiError;

export async function apiFetch<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    // Session lives in an HttpOnly cookie managed by the backend.
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      // FormData bodies (file uploads) need the browser's multipart boundary.
      ...(typeof init.body === 'string'
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new ApiError(response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
