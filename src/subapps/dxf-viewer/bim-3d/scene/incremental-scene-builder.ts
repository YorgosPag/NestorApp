/**
 * incremental-scene-builder — SSoT time-sliced build runner (ADR-645 Φάση A).
 *
 * THE PROBLEM (ADR-645 §2.2): the 3D DXF overlay build is synchronous, all-at-once,
 * inside a React commit effect. On a large multi-floor drawing the 468×(floors)
 * `buildDxfTextMesh` calls block the main thread for seconds → «page unresponsive».
 * The 2D pipeline never freezes because it time-slices + culls + streams (ADR-639);
 * the 3D path reused none of that for the *build*.
 *
 * THE FIX (big-player-grade, Forge/APS · Speckle · three.js editor · Revit · C4D):
 * NEVER a synchronous mega-build on the main thread. Process `total` work units across
 * many animation frames, each frame doing only as many units as fit inside a small
 * frame budget (~8ms), yielding control back to the browser between frames so it stays
 * responsive (pan / zoom / orbit) while the scene «fills in». Cancellable — a new sync
 * (re-sync / floor switch / unmount) aborts the in-flight build cleanly.
 *
 * SSoT: this is the ONE time-slicing primitive for 3D scene builds. It rides the
 * existing `UnifiedFrameScheduler` one-shot rAF (ADR-040) — it does NOT open a second
 * rAF loop. Pure + dependency-injected (`IncrementalBuildDeps`) so it is fully jest-
 * driveable with a fake scheduler + fake clock (no real rAF, no `performance.now`).
 *
 * @module bim-3d/scene/incremental-scene-builder
 */

import { UnifiedFrameScheduler } from '../../rendering/core/UnifiedFrameScheduler';
import { DXF_TIMING } from '../../config/dxf-timing';

/** Frame time budget (ms): process units until this much wall-clock elapses, then yield.
 *  SSoT: {@link DXF_TIMING.frame.INCREMENTAL_BUILD_BUDGET} (ADR-516/ADR-645). */
export const DEFAULT_FRAME_BUDGET_MS = DXF_TIMING.frame.INCREMENTAL_BUILD_BUDGET;

/**
 * How many units to process between clock reads. `now()` is not free, so we do it in
 * small chunks rather than once per unit — amortises the clock cost without overshooting
 * the budget by more than one chunk's worth of work.
 */
export const DEFAULT_CHUNK_SIZE = 8;

/** Injected side-effects — defaulted to the real `UnifiedFrameScheduler` + `performance.now`. */
export interface IncrementalBuildDeps {
  /** Schedule `cb` to run on the next animation frame (same-`id` calls de-dupe, last wins). */
  scheduleFrame(id: string, cb: () => void): void;
  /** Cancel a pending scheduled frame for `id`. */
  cancelFrame(id: string): void;
  /** Current wall-clock in milliseconds. */
  now(): number;
}

/** Options describing ONE time-sliced build. */
export interface IncrementalBuildOptions {
  /** Stable scheduler id (one active build per id; a re-run with the same id replaces it). */
  readonly id: string;
  /** Total number of work units (`processItem` is called for index 0 … total-1). */
  readonly total: number;
  /** Build the single work unit at `index`. Must not throw for the run to stay healthy. */
  processItem(index: number): void;
  /** Frame budget in ms (default {@link DEFAULT_FRAME_BUDGET_MS}). */
  readonly frameBudgetMs?: number;
  /** Units per clock-read chunk (default {@link DEFAULT_CHUNK_SIZE}). */
  readonly chunkSize?: number;
  /** Fired after each frame's batch with the running (done, total) — e.g. progress + markDirty. */
  onFrameProcessed?(done: number, total: number): void;
  /** Fired once, after the final unit completes. */
  onComplete?(): void;
  /** Fired once if the build is cancelled before completing. */
  onCancelled?(): void;
}

/** Handle to observe / abort a running build. */
export interface IncrementalBuildHandle {
  /** Abort the build (idempotent). Fires `onCancelled` once if it had not completed. */
  cancel(): void;
  /** True once every unit has been processed. */
  isDone(): boolean;
  /** True once {@link cancel} has aborted an incomplete build. */
  isCancelled(): boolean;
}

/** Real deps: the `UnifiedFrameScheduler` one-shot rAF (ADR-040 SSoT) + `performance.now`. */
const defaultDeps: IncrementalBuildDeps = {
  scheduleFrame: (id, cb) => UnifiedFrameScheduler.scheduleOnce(id, cb),
  cancelFrame: (id) => { UnifiedFrameScheduler.cancelOnce(id); },
  now: () => performance.now(),
};

/**
 * Run a time-sliced build. Returns immediately with a handle; the work happens across
 * subsequent frames driven by `deps.scheduleFrame`. A `total <= 0` build completes on
 * its first scheduled frame (fires `onComplete`, no `processItem` calls).
 */
export function runIncrementalBuild(
  options: IncrementalBuildOptions,
  deps: IncrementalBuildDeps = defaultDeps,
): IncrementalBuildHandle {
  const budget = options.frameBudgetMs ?? DEFAULT_FRAME_BUDGET_MS;
  const chunk = Math.max(1, options.chunkSize ?? DEFAULT_CHUNK_SIZE);
  const total = Math.max(0, options.total);

  let cursor = 0;
  let done = false;
  let cancelled = false;

  const runFrame = (): void => {
    if (cancelled || done) return;
    const frameStart = deps.now();
    while (cursor < total) {
      const batchEnd = Math.min(cursor + chunk, total);
      for (let i = cursor; i < batchEnd; i++) options.processItem(i);
      cursor = batchEnd;
      // Yield once the budget is spent — the remaining units resume on the next frame.
      if (deps.now() - frameStart >= budget) break;
    }
    if (cursor >= total) {
      done = true;
      options.onFrameProcessed?.(cursor, total);
      options.onComplete?.();
      return;
    }
    options.onFrameProcessed?.(cursor, total);
    deps.scheduleFrame(options.id, runFrame);
  };

  deps.scheduleFrame(options.id, runFrame);

  return {
    cancel(): void {
      if (done || cancelled) return;
      cancelled = true;
      deps.cancelFrame(options.id);
      options.onCancelled?.();
    },
    isDone: () => done,
    isCancelled: () => cancelled,
  };
}
