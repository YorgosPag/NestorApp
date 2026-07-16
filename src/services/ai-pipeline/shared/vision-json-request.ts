/**
 * =============================================================================
 * AI PIPELINE — VISION JSON REQUEST (SSoT)
 * =============================================================================
 *
 * The one shape every ai-pipeline vision caller needs: "send this system prompt
 * plus this already-built content to the vision model, and hold me to this JSON
 * schema". Five call sites (document preview, invoice extraction, contact
 * document classification, document reading, ISO-19650 enrichment) had the same
 * config + request literal inline; token-level clone detection (ADR-584) flags
 * it, and every copy is a place the next model or timeout policy change can be
 * forgotten.
 *
 * This sits ABOVE `@/services/ai/openai-responses`, not inside it: the SSoT
 * there is transport only and deliberately reads no config of its own, whereas
 * this module owns the ai-pipeline *policy* — which model, which base URL, and
 * that these calls do not retry.
 *
 * `maxRetries: 0` is the historical behaviour of all five sites: one attempt,
 * no retry. Vision calls are the most expensive requests the pipeline makes and
 * a blind retry doubles both latency and token spend on the failures that were
 * never going to succeed (a 400 stays a 400). Changing that is a product
 * decision, not a default to drift into.
 *
 * ⚠️ **NO `import 'server-only'` here — deliberate** (ADR-373 §D5/§D9). One of
 * the five callers, `iso19650-enricher`, sits on a static import chain that
 * reaches client components (`file-record.service` → `useFileDownload` →
 * `PhotoPreviewModal`); it guards itself at runtime instead (`typeof window`).
 * Adding `server-only` to anything on that chain breaks the client build, which
 * is why every module behind `@/services/ai/openai-responses` is server-only
 * free. This module reads no secrets — the caller passes the resolved API key.
 *
 * @module services/ai-pipeline/shared/vision-json-request
 * @see ADR-294 — SSoT Ratchet (module `openai-provider`)
 * @see ADR-373 §D5 — AI Auto-Fill Architecture (server-only-free chain)
 * @see ADR-584 — jscpd clone ratchet
 */

import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import type { Logger } from '@/lib/telemetry/Logger';
import {
  executeResponsesRequest,
  ResponsesApiError,
  type ResponsesContent,
  type ResponsesJsonSchemaFormat,
} from '@/services/ai/openai-responses';

export interface VisionJsonRequestParams {
  /** Resolved OpenAI key — the caller owns the env read. */
  readonly apiKey: string;
  /** Per-site timeout; these range from the shared default up to 30s. */
  readonly timeoutMs: number;
  readonly systemPrompt: string;
  /** Pre-built user content — see `buildBufferVisionContent`. */
  readonly content: ResponsesContent[];
  readonly format: ResponsesJsonSchemaFormat;
}

/**
 * One vision request against the Responses API, returning the raw JSON payload.
 *
 * Throws exactly what the transport SSoT throws — `ResponsesApiError` for a
 * non-OK status, the platform's own error for a timeout or network fault. Each
 * caller maps those onto its own fallback, because what a failure *means*
 * differs per site (null preview vs. fallback classification vs. HTTP 502).
 */
export async function requestVisionJson(params: VisionJsonRequestParams): Promise<unknown> {
  return executeResponsesRequest(
    {
      apiKey: params.apiKey,
      baseUrl: AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL,
      timeoutMs: params.timeoutMs,
      maxRetries: 0,
    },
    {
      model: AI_ANALYSIS_DEFAULTS.OPENAI.VISION_MODEL,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: params.systemPrompt }] },
        { role: 'user', content: params.content },
      ],
      text: { format: params.format },
    },
  );
}

/** The two log lines a vision caller emits when the call does not come back. */
export interface VisionFailureLabels {
  /** Emitted when the API answered with a non-OK status. */
  readonly nonOk: string;
  /** Emitted for a timeout, a network fault, or anything else. */
  readonly generic: string;
}

/**
 * Warn-log a failed vision call and yield `null`, the way the buffer-vision
 * callers all do.
 *
 * The split matters: a `ResponsesApiError` means the API answered and refused,
 * so the status and its raw body are the whole diagnosis and are worth logging
 * (capped at 500 chars — OpenAI error bodies can carry a full echo of the
 * request). Anything else never reached the API and has only a message.
 *
 * Callers pass their own label strings rather than a prefix, because the log
 * lines predate this helper and are what existing log searches match on.
 */
export function logVisionFailure(
  logger: Logger,
  labels: VisionFailureLabels,
  error: unknown,
  fileRecordId: string,
): null {
  if (error instanceof ResponsesApiError) {
    logger.warn(labels.nonOk, {
      status: error.status,
      fileRecordId,
      error: (error.body || 'no body').substring(0, 500),
    });
    return null;
  }

  logger.warn(labels.generic, {
    error: error instanceof Error ? error.message : 'unknown',
    fileRecordId,
  });
  return null;
}
