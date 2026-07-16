/**
 * =============================================================================
 * OPENAI RESPONSES API — SSoT BARREL
 * =============================================================================
 *
 * Every `/responses` caller imports from here. Re-declaring the wire types or
 * re-implementing `extractOutputText` / the fetch+retry loop elsewhere is an
 * ADR-294 ratchet violation (module `openai-provider`).
 *
 * Scope: the Responses API only. Chat Completions (`/chat/completions`) is a
 * different protocol with different types — see
 * `services/ai-pipeline/agentic-openai-client.ts`.
 *
 * Every module behind this barrel is client-safe (no `server-only`, no secret
 * reads), which keeps it importable from the `server-only`-free vision helpers
 * that ADR-373 §D5 requires.
 *
 * @module services/ai/openai-responses
 * @see ADR-294 — SSoT Ratchet
 * @see ADR-373 §D5 — AI Auto-Fill Architecture
 */

export type {
  ResponsesContent,
  ResponsesMessage,
  ResponsesJsonSchemaFormat,
  ResponsesTool,
  ResponsesRequestBody,
  ResponsesErrorPayload,
} from './wire-types';

export { extractOutputText } from './extract-output-text';

export {
  executeResponsesRequest,
  type ResponsesRequestConfig,
} from './execute-request';

export { isImageMime, toBase64DataUri, beginVisionContent } from './vision-content';

export { downloadFile, DEFAULT_MAX_FILE_SIZE_BYTES } from './download-file';
