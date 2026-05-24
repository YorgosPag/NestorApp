/**
 * =============================================================================
 * VISION HELPERS — SSoT for OpenAI Responses-API vision pipeline
 * =============================================================================
 *
 * Shared utilities reused by every AI-vision consumer in the codebase
 * (contact classifier, ISO 19650 enricher, document reader, invoice
 * extractor, document preview). Extracted per ADR-373 Phase 2 Boy Scout
 * (N.0.2) and to keep `server-only` AI handlers off the static import
 * graph reaching client bundles (Turbopack follows static chains even
 * behind dynamic-import boundaries → moving the shared helpers to a
 * `server-only`-free module breaks the poisonous chain).
 *
 * This module is **client-safe**: pure `fetch` + `Buffer` + JSON parsing.
 * It does NOT read secrets, does NOT touch Firestore, and never throws.
 *
 * @module services/ai-pipeline/tools/handlers/vision-helpers
 * @see ADR-373 §D5 — AI Auto-Fill Architecture
 * @see ADR-191 — Enterprise Document Management
 */

import { isRecord } from '@/lib/type-guards';

// ============================================================================
// TYPES
// ============================================================================

export type VisionContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'input_file'; filename: string; file_data: string };

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default hard size cap — 4MB. Callers may override via `downloadFile` arg. */
export const DEFAULT_MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

// ============================================================================
// MIME UTILS
// ============================================================================

export function isImageMime(contentType: string): boolean {
  return contentType.startsWith('image/');
}

// ============================================================================
// DOWNLOAD
// ============================================================================

/**
 * Download a remote file into a Buffer with a hard size cap. Returns `null`
 * on any failure (network error, non-OK status, oversized payload).
 *
 * @param url - Public/signed file URL.
 * @param maxSizeBytes - Hard cap (default 4MB). Vision callers with larger
 *   payloads (e.g., architectural PDFs up to 8MB) pass an explicit override.
 */
export async function downloadFile(
  url: string,
  maxSizeBytes: number = DEFAULT_MAX_FILE_SIZE_BYTES,
): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) return null;

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxSizeBytes) return null;

    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

/**
 * Extract the first plain-text output from an OpenAI Responses-API payload.
 * Handles both shortcut `output_text` and the structured `output[].content[]`
 * variants. Returns `null` if no usable text is present.
 */
export function extractOutputText(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  const outputText = (payload as Record<string, unknown>).output_text;
  if (typeof outputText === 'string' && outputText.trim()) {
    return outputText.trim();
  }

  const output = (payload as Record<string, unknown>).output;
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    if (!isRecord(item)) continue;
    if ((item as Record<string, unknown>).type !== 'message') continue;
    const itemContent = (item as Record<string, unknown>).content;
    if (!Array.isArray(itemContent)) continue;

    for (const entry of itemContent) {
      if (!isRecord(entry)) continue;
      if ((entry as Record<string, unknown>).type !== 'output_text') continue;
      const text = (entry as Record<string, unknown>).text;
      if (typeof text === 'string' && text.trim()) {
        return text.trim();
      }
    }
  }

  return null;
}
