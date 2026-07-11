/**
 * 🏢 ENTERPRISE: DXF Import Thresholds (SSoT)
 *
 * ADR-639 Στάδιο 1 — Large-file DXF import routing.
 *
 * Files at or above this byte size are parsed inside a Web Worker so the heavy,
 * synchronous line-by-line parse runs OFF the main thread and the browser UI stays
 * responsive (no "page unresponsive" freeze on 40 MB / millions-of-lines permit plans).
 *
 * Smaller files parse inline on the main thread: their parse is fast enough that the
 * ~tens-of-ms Worker spin-up + message round-trip would cost more than it saves.
 *
 * The number is deliberately conservative — a typical hand-drawn plan is well under
 * 5 MB, while exploded permit drawings (everything as individual LINEs) are tens of MB.
 */
export const DXF_IMPORT_THRESHOLDS = {
  /** Route parsing to the Web Worker when `file.size` (bytes) ≥ this value. 5 MB. */
  WORKER_PARSE_MIN_BYTES: 5 * 1024 * 1024,
} as const;
