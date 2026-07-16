/**
 * =============================================================================
 * OPENAI RESPONSES API — TYPED TRANSPORT ERROR (SSoT)
 * =============================================================================
 *
 * The error every `/responses` non-OK status throws. Carries the HTTP `status`
 * and the raw response `body` alongside the human-readable `message`.
 *
 * WHY a typed error and not a plain `Error`: the status code is the field that
 * decides what a caller does next — 429 means back off, 401 means the key is
 * wrong, 400 means the request will never succeed. Folding it into a message
 * string forces every caller to regex it back out, and the raw body (which
 * carries OpenAI's `error.type` / `error.code`) is lost entirely. This mirrors
 * the official OpenAI SDK (`APIError.status`) and Stripe (`StripeAPIError.raw`),
 * where the status is a first-class field.
 *
 * `message` is deliberately IDENTICAL to what the previous inline `throw new
 * Error(...)` produced — API `error.message` when parseable, else
 * `OpenAI error (<status>)`. Callers that only read `.message` are unaffected;
 * `instanceof Error` still holds.
 *
 * This module is **client-safe**: one class, no I/O, no secrets.
 *
 * @module services/ai/openai-responses/responses-error
 * @see ADR-294 — SSoT Ratchet (module `openai-provider`)
 */

/**
 * A non-OK HTTP response from the Responses API.
 *
 * Thrown only for status-level failures. Network faults and timeouts surface as
 * the platform's own errors (`TypeError`, `TimeoutError`) — they have no status
 * and are deliberately not wrapped.
 */
export class ResponsesApiError extends Error {
  /** HTTP status of the failed response (e.g. 429, 503). */
  readonly status: number;

  /** Raw, untruncated response body. Empty string when it could not be read. */
  readonly body: string;

  constructor(status: number, body: string, message: string) {
    super(message);
    this.name = 'ResponsesApiError';
    this.status = status;
    this.body = body;

    // Restores the prototype chain across the ES5 `extends Error` downlevel,
    // without which `instanceof ResponsesApiError` is false at every call site.
    Object.setPrototypeOf(this, ResponsesApiError.prototype);
  }
}
