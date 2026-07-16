/**
 * =============================================================================
 * VISION HELPERS — re-export shim → `@/services/ai/openai-responses`
 * =============================================================================
 *
 * This file used to own the OpenAI Responses-API vision helpers. It now
 * re-exports them from the canonical module, which lives outside
 * `tools/handlers/` because three more clients (accounting document analyzer,
 * procurement quote analyzer, ai-analysis provider) need the same protocol and
 * had each re-implemented it. Same conversion the `greek-text-utils` module
 * went through (ADR-314 Phase D.3a).
 *
 * The shim is kept so the five existing ai-pipeline consumers — and the
 * `jest.mock('.../vision-helpers')` in the iso19650 tests — keep working
 * untouched.
 *
 * ADR-373 §D5 note: every module behind `@/services/ai/openai-responses` is
 * `server-only`-free, so this file stays off the poisonous static import chain
 * that reaches client bundles. Do NOT re-export anything `server-only` here.
 *
 * @module services/ai-pipeline/tools/handlers/vision-helpers
 * @see ADR-373 §D5 — AI Auto-Fill Architecture
 * @see ADR-191 — Enterprise Document Management
 * @see ADR-294 — SSoT Ratchet (module `openai-provider`)
 */

export {
  extractOutputText,
  isImageMime,
  downloadFile,
  DEFAULT_MAX_FILE_SIZE_BYTES,
} from '@/services/ai/openai-responses';

/** @deprecated Prefer `ResponsesContent` from `@/services/ai/openai-responses`. */
export type { ResponsesContent as VisionContent } from '@/services/ai/openai-responses';
