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

import type { ResponsesErrorPayload, ResponsesRequestBody } from './wire-types';

/** Fully-resolved per-call transport config. No env reads happen here. */
export interface ResponsesRequestConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
}

/**
 * One round-trip. Throws on timeout, network error, or non-OK status.
 * The thrown message prefers the API's own `error.message`, falling back to
 * `OpenAI error (<status>)`.
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
    const errorPayload = (await response.json().catch(() => ({}))) as ResponsesErrorPayload;
    throw new Error(errorPayload.error?.message || `OpenAI error (${response.status})`);
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
