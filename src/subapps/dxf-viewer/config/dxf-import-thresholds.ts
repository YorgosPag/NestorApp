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
import { DXF_TIMING } from './dxf-timing';

export const DXF_IMPORT_THRESHOLDS = {
  /** Route parsing to the Web Worker when `file.size` (bytes) ≥ this value. 5 MB. */
  WORKER_PARSE_MIN_BYTES: 5 * 1024 * 1024,

  /**
   * ADR-639 Στάδιο 1 — max wait for the worker to signal it LOADED (posted `worker-ready`).
   *
   * The worker posts `worker-ready` at module load, the instant its import chain finishes
   * executing in the Worker scope. If it does NOT arrive within this window, the module
   * failed to load (an import-chain throw under Turbopack — `onerror` may not fire and the
   * parse `postMessage` goes nowhere), so we fall back to the main-thread parse FAST instead
   * of dead-waiting the whole parse ceiling on a wedged worker. A healthy module signals in
   * well under a second; 8 s tolerates a cold worker-bundle compile in dev/Turbopack.
   * SSoT: DXF_TIMING.lifecycle.IMPORT_WORKER_READY_PROBE (ADR-516).
   */
  WORKER_READY_PROBE_MS: DXF_TIMING.lifecycle.IMPORT_WORKER_READY_PROBE,
  /**
   * ADR-639 Στάδιο 1 — parse ceiling, applied ONLY once the worker is confirmed alive (it
   * has posted `worker-ready`). The worker never freezes the UI, so this only abandons a
   * worker that loaded but then wedged mid-parse; the main-thread fallback finishes the job.
   * Generous but bounded — a healthy worker parses a 215k-entity permit well within it.
   * SSoT: DXF_TIMING.lifecycle.IMPORT_WORKER_PARSE_TIMEOUT (ADR-516).
   */
  WORKER_PARSE_TIMEOUT_MS: DXF_TIMING.lifecycle.IMPORT_WORKER_PARSE_TIMEOUT,

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

  /**
   * ADR-645 Φάση A — engage INCREMENTAL (time-sliced) 3D text streaming only when a build has
   * at least this many text entities.
   *
   * The 2D→3D freeze (§2.2) is the synchronous, all-at-once `buildDxfTextMesh` loop: each text
   * entity spins up a `<canvas>` + vector glyph engine + a `CanvasTexture` GPU upload. At the
   * real 40 MB / 468-text (× floors) scale this blocks the main thread for seconds. Above this
   * gate the text meshes are built across frames on a ~8 ms budget so the browser stays
   * responsive; below it the handful of labels build synchronously inline — fast enough that the
   * streaming overhead (a progress overlay flash, per-frame yields) would cost more than it saves.
   *
   * Counted per BUILD (single floor OR the whole «Όλοι οι όροφοι» stack aggregated), so a
   * multi-floor view with few labels each but many floors correctly streams. 40 is comfortably
   * above a typical annotated plan's title block yet well below the drawings that motivated this.
   */
  INCREMENTAL_3D_MIN_ENTITIES: 40,
} as const;
