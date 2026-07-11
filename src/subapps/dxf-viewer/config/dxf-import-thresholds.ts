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

  /**
   * ADR-639 Στάδιο 5 — engage the WebGL line layer only for large scenes.
   *
   * The GPU line layer (persistent `LineSegments2` buffers, camera-matrix-only
   * pan/zoom) exists to make the 215k-entity permit plans navigable at 60fps. On
   * small / annotation-heavy drawings it buys nothing — the Canvas2D `DxfRenderer`
   * + bitmap cache already renders them instantly — while adding WebGL context
   * cost, a painter-order deviation (all GPU lines sit below all Canvas2D entities)
   * and z-order-fidelity risk. So the whole layer stays OFF (byte-identical current
   * behaviour, zero WebGL risk) unless the scene's owned-line count crosses this
   * gate. 50k is comfortably above any hand-drawn plan yet well below the exploded
   * permit files (209k plain LINEs) that motivated Στάδιο 5.
   */
  WEBGL_LINE_LAYER_MIN_ENTITIES: 50_000,
} as const;
