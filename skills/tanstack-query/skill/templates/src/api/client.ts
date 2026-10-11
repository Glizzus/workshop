// Thin fetch wrapper. Every queryFn and mutationFn goes through apiFetch, because:
// - fetch() does NOT reject on 404/500. apiFetch throws ApiError, so TanStack Query
//   puts the query in its error state instead of caching the error body as data.
// - it forwards the AbortSignal, so a cancelled query also cancels its HTTP request.
// - it parses JSON and handles empty responses (204 No Content).
// Add auth headers in one place: inside apiFetch.

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

const BASE_URL: string = import.meta.env.VITE_API_URL ?? '/api'

/** Absolute URL for an API path. Test mocks (MSW) use this too, so both always agree. */
export function apiUrl(path: string): string {
  return new URL(`${BASE_URL}${path}`, window.location.origin).toString()
}

type QueryParams = Record<string, string | number | boolean | undefined>

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: QueryParams
  body?: unknown
  signal?: AbortSignal
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const url = new URL(apiUrl(path))
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  })

  const body = await readBody(response)
  if (!response.ok) {
    throw new ApiError(response.status, body, `HTTP ${response.status}`)
  }
  return body as T
}
