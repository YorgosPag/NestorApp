/**
 * telemetry-uploader — ADR-366 §C.7.Q3
 *
 * POST helper for the anonymous telemetry endpoint. Adds the session id as a
 * request header so the server-side rate limiter (1 req/min/session) can key
 * on the anonymous identifier without needing auth.
 *
 * Retry: exponential backoff (500ms × 2^attempt, max 3 attempts). The endpoint
 * is best-effort — failures are intentionally silent to avoid leaking
 * "telemetry is on" signals into the user-visible error stream.
 *
 * Erase: separate endpoint with sessionId-ownership verification handled by
 * the server (Article 17 right to erasure).
 */

import type { AnonymizedTelemetrySample } from './anonymizer';

const UPLOAD_URL = '/api/telemetry/bim-performance';
const ERASE_URL = '/api/telemetry/bim-performance/erase';
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const SESSION_HEADER = 'x-bim-session-id';

interface UploadInput {
  sessionId: string;
  samples: AnonymizedTelemetrySample[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postOnce(input: UploadInput): Promise<Response> {
  return fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [SESSION_HEADER]: input.sessionId,
    },
    body: JSON.stringify({ samples: input.samples }),
    keepalive: true,
  });
}

/**
 * Upload a batch with exponential backoff on transient failures.
 * 4xx responses are treated as terminal (don't retry on validation errors).
 */
export async function uploadTelemetryBatch(input: UploadInput): Promise<void> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await postOnce(input);
      if (res.ok) return;
      if (res.status >= 400 && res.status < 500) return;
    } catch {
      /* network error — fall through to retry */
    }
    if (attempt < MAX_ATTEMPTS - 1) {
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
    }
  }
}

/**
 * Right-to-erasure (Article 17). Asks the server to delete every sample tied
 * to the provided sessionId. Server verifies ownership via the same
 * `x-bim-session-id` header — anyone replaying must possess the salt to
 * recompute the hash, so casual replay is impossible.
 */
export async function eraseTelemetryHistory(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(ERASE_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [SESSION_HEADER]: sessionId,
      },
      body: JSON.stringify({ sessionId }),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}
