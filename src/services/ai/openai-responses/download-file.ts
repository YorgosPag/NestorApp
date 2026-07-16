/**
 * =============================================================================
 * OPENAI RESPONSES API — REMOTE FILE DOWNLOAD (SSoT)
 * =============================================================================
 *
 * Size-capped download over plain `fetch`, for vision callers that hold a
 * public/signed URL. Callers that must read from the Firebase admin bucket use
 * `@/lib/storage/admin-storage-download` instead — different transport,
 * different auth, deliberately not merged with this.
 *
 * This module is **client-safe**: plain `fetch` + `Buffer`, never throws.
 *
 * @module services/ai/openai-responses/download-file
 * @see ADR-373 §D5 — AI Auto-Fill Architecture
 */

/** Default hard size cap — 4MB. Callers may override per call. */
export const DEFAULT_MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

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
