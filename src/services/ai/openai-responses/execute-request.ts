/**
 * =============================================================================
 * OPENAI RESPONSES API — REQUEST EXECUTION (SSoT)
 * =============================================================================
 *
 * The single `POST {baseUrl}/responses` round-trip: auth header, abort-based
 * timeout, retry loop, error-payload unwrapping. Previously duplicated verbatim
 * in three clients.
 *
 * The caller owns config resolution (env vars, per-call option overrides) and
 * passes the resolved values in — this module reads no secrets of its own.
 *
 * @module services/ai/openai-responses/execute-request
 * @see ADR-294 — SSoT Ratchet (module `openai-provider`)
 */

import { ResponsesApiError } from './responses-error';
import type { ResponsesErrorPayload, ResponsesRequestBody } from './wire-types';

/**
 * Read the error body once, as text, and recover the API's own message from it.
 *
 * Text-first (not `response.json()`) so the raw payload survives onto
 * `ResponsesApiError.body` even when it is not JSON at all — a gateway's HTML
 * 502 page is exactly the case you most want to see in the log, and it is the
 * case `.json()` throws away.
 */
async function readErrorBody(response: Response): Promise<{ body: string; message: string }> {
  const body = await response.text().catch(() => '');

  let message = '';
  try {
    const payload = JSON.parse(body) as ResponsesErrorPayload;
    message = payload.error?.message ?? '';
  } catch {
    // Non-JSON body — fall through to the status-based message.
  }

  return { body, message: message || `OpenAI error (${response.status})` };
}

/** Fully-resolved per-call transport config. No env reads happen here. */
export interface ResponsesRequestConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
}

/**
 * One round-trip. Throws on timeout, network error, or non-OK status.
 *
 * A non-OK status throws `ResponsesApiError` (carrying `status` + raw `body`);
 * its `message` prefers the API's own `error.message`, falling back to
 * `OpenAI error (<status>)`. Timeouts and network faults throw the platform's
 * own error untouched.
 */
async function postResponsesOnce(
  config: ResponsesRequestConfig,
  request: ResponsesRequestBody,
): Promise<unknown> {
  // `AbortSignal.timeout` owns its own timer and clears it when the signal is
  // garbage-collected. A hand-rolled `AbortController` + `setTimeout` leaks the
  // timer whenever `fetch` throws before the matching `clearTimeout` runs,
  // holding the event loop open for the full `timeoutMs`.
  const response = await fetch(`${config.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    const { body, message } = await readErrorBody(response);
    throw new ResponsesApiError(response.status, body, message);
  }

  return await response.json();
}

/**
 * Execute a Responses-API request, retrying up to `config.maxRetries` times.
 * Retries are immediate (no backoff) — preserved from the three call sites this
 * replaced. Returns the raw JSON payload; use `extractOutputText` to read it.
 */
export async function executeResponsesRequest(
  config: ResponsesRequestConfig,
  request: ResponsesRequestBody,
): Promise<unknown> {
  let attempt = 0;

  while (attempt <= config.maxRetries) {
    try {
      return await postResponsesOnce(config, request);
    } catch (error) {
      if (attempt >= config.maxRetries) {
        throw error;
      }
      attempt += 1;
    }
  }

  throw new Error('OpenAI Responses request failed');
}
