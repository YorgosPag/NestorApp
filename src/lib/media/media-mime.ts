/**
 * =============================================================================
 * media-mime — MediaRecorder MIME negotiation, owned once
 * =============================================================================
 *
 * Every MediaRecorder consumer faces the same two questions: which container
 * this browser will actually accept, and what to name the resulting file.
 * `useVideoRecorder` and `useVoiceRecorder` each answered them with their own
 * copy of the same probe loop and the same extension switch.
 *
 * The *candidate lists* stay with the callers — they are domain data (a video
 * recorder wants vp9/opus, a voice recorder wants opus) and do not belong to a
 * generic helper. Only the mechanics live here.
 *
 * @module lib/media/media-mime
 * @ssot ADR-584 — shared MediaRecorder MIME plumbing
 */

/**
 * First candidate this browser can actually record, else `fallback`.
 *
 * `MediaRecorder.isTypeSupported` is the only honest source: support varies by
 * browser *and* platform build, so the list must be probed, not assumed.
 * Returns `fallback` when MediaRecorder is absent entirely (SSR, older Safari),
 * which keeps callers free of their own `typeof` guard.
 */
export function pickSupportedMime(
  candidates: readonly string[],
  fallback: string
): string {
  if (typeof MediaRecorder === 'undefined') return fallback;
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return fallback;
}

/**
 * File extension for a recorded MIME type.
 *
 * Matches on substring because MediaRecorder hands back the full type with its
 * codec parameters attached (`video/webm;codecs=vp9,opus`).
 */
export function getExtensionFromMime(mime: string): string {
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}
