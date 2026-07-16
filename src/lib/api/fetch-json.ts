/**
 * =============================================================================
 * fetchJson — SSoT for session-cookie JSON calls to our own /api routes
 * =============================================================================
 *
 * Reads the server's error envelope (`{ error }`) off a non-2xx response and
 * rethrows it as an Error, so callers can hand it straight to getErrorMessage()
 * instead of surfacing a bare status code.
 *
 * NOT a replacement for `apiClient` (@/lib/api/enterprise-api-client), which
 * stays canonical for authenticated cross-service calls: it attaches a Bearer
 * token, retries with backoff, and unwraps `{ success, data }` down to `data`.
 * This helper deliberately does none of that — its callers are same-origin route
 * handlers authenticated by session cookie, and they read `success`/`data` off
 * the envelope themselves. It exists because that combination was hand-rolled
 * six times, byte-identical, across five hooks and one gateway (ADR-584).
 *
 * @module lib/api/fetch-json
 * @see ADR-584 — token-based clone ratchet (jscpd)
 */

/**
 * GET/POST/PATCH/DELETE one of our own /api routes and parse the JSON body.
 *
 * @throws Error carrying the server's `error` field, or `HTTP <status>` when the
 *         response carries no parsable envelope.
 */
export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(body.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/** Build the RequestInit for a JSON-bodied mutation against our own /api routes. */
export function jsonRequest(method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}
