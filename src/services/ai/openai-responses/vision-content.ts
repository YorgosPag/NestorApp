/**
 * =============================================================================
 * OPENAI RESPONSES API — VISION CONTENT BUILDING (SSoT)
 * =============================================================================
 *
 * Primitives for assembling `ResponsesContent[]` payloads. Deliberately small:
 * each client's *policy* (rasterize PDFs? send a URL or inline base64? which
 * MIME types count as text?) is domain-specific and stays with the client —
 * only the mechanics live here.
 *
 * This module is **client-safe**: pure string/Buffer work, no I/O.
 *
 * @module services/ai/openai-responses/vision-content
 * @see ADR-373 §D5 — AI Auto-Fill Architecture
 */

import type { ResponsesContent } from './wire-types';

/** True for any `image/*` MIME type. */
export function isImageMime(contentType: string | undefined): boolean {
  return Boolean(contentType && contentType.startsWith('image/'));
}

/**
 * Open a vision payload with the prompt, plus the file itself when it is an
 * image the API can fetch straight from `fileUrl`.
 *
 * PDFs are deliberately NOT attached here: attaching one is a policy call each
 * caller makes differently (inline base64 vs rasterize-to-PNG first), and it
 * needs I/O this client-safe module must not do. `pdfAttachmentPending` tells
 * the caller it still owes the payload a PDF part.
 *
 * Anything that is neither image nor PDF yields the prompt alone — matching the
 * historical behaviour of both analyzers.
 */
export function beginVisionContent(
  promptText: string,
  fileUrl: string,
  mimeType: string,
): { content: ResponsesContent[]; pdfAttachmentPending: boolean } {
  const content: ResponsesContent[] = [{ type: 'input_text', text: promptText }];

  if (isImageMime(mimeType)) {
    content.push({ type: 'input_image', image_url: fileUrl });
    return { content, pdfAttachmentPending: false };
  }

  return { content, pdfAttachmentPending: mimeType === 'application/pdf' };
}

/**
 * Encode a Buffer for an `input_image` / `input_file` part.
 *
 * With a MIME type → a full `data:<mime>;base64,<data>` URI.
 * Without one → bare base64, matching the historical behaviour of the
 * ai-analysis provider (which omits the prefix when the MIME is unknown).
 */
export function toBase64DataUri(buffer: Buffer, mimeType?: string): string {
  const base64 = buffer.toString('base64');
  if (!mimeType) {
    return base64;
  }
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Prompt + one wholly-inlined file, as `[input_text, input_image | input_file]`.
 *
 * The counterpart to `beginVisionContent`: that one hands the API a URL to
 * fetch and defers the PDF question to the caller, whereas this one already
 * holds the bytes and inlines everything as base64 — so there is no pending
 * attachment and nothing left for the caller to decide.
 *
 * Images ride in `input_image`; everything else (PDF, DOCX, XLSX) rides in
 * `input_file`, which is the part that carries a filename.
 */
export function buildBufferVisionContent(
  promptText: string,
  buffer: Buffer,
  filename: string,
  mimeType: string,
): ResponsesContent[] {
  const dataUri = toBase64DataUri(buffer, mimeType);

  return [
    { type: 'input_text', text: promptText },
    isImageMime(mimeType)
      ? { type: 'input_image', image_url: dataUri }
      : { type: 'input_file', filename, file_data: dataUri },
  ];
}
