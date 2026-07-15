/**
 * createFreehandTraceStore — SSoT factory for freehand pointer-trace stores (ADR-658).
 *
 * Module-level pub/sub, ZERO React state (ADR-040 micro-leaf pattern, mirrors
 * HoverStore / ImmediatePositionStore). Powers the «Μολύβι» sketch tool; the
 * lasso-crop store predates it and can migrate onto this factory as an N.18
 * de-duplication follow-up (its extra `nearClose` slice would become a config flag).
 *
 * Lifecycle (caller wires it to the canvas pointer events):
 *   startAt(x,y) — pointerdown → activates, seeds the first point
 *   addPoint(x,y) — pointermove (throttled in SCREEN space by the caller)
 *   finish()     — pointerup → runs `onFinish(points)` when active with ≥ minPoints, then clears
 *   cancel()     — Escape / tool switch → clears silently
 */
import { createExternalStore } from '../../stores/createExternalStore';

export interface FreehandTraceSnapshot {
  points: Array<[number, number]>;
  /** True when the cursor is near the start point → auto-close affordance (D5). */
  nearClose: boolean;
}

export interface FreehandTraceStore {
  isActive(): boolean;
  getPoints(): Array<[number, number]>;
  isNearClose(): boolean;
  getSnapshot(): FreehandTraceSnapshot;
  startAt(x: number, y: number): void;
  addPoint(x: number, y: number): void;
  setNearClose(v: boolean): void;
  finish(): void;
  cancel(): void;
  subscribe(listener: () => void): () => void;
}

export interface FreehandTraceConfig {
  /** Minimum points required for `onFinish` to fire (2 = open polyline, 3 = closable polygon). */
  minPoints: number;
  /**
   * Runs on `finish()` with the collected world-space trace + whether the release was
   * near the start (→ close), before the store clears.
   */
  onFinish: (points: Array<[number, number]>, nearClose: boolean) => void;
}

export function createFreehandTraceStore(config: FreehandTraceConfig): FreehandTraceStore {
  // Plain module `let`s = mutation accelerators; the external store carries only the
  // composite snapshot, rebuilt once per `notify()` (mirrors LassoFreehandStore).
  let active = false;
  let nearClose = false;
  let points: Array<[number, number]> = [];

  const store = createExternalStore<FreehandTraceSnapshot>({ points, nearClose });
  const notify = (): void => store.set({ points, nearClose });

  return {
    isActive: () => active,
    getPoints: () => points,
    isNearClose: () => nearClose,
    getSnapshot: () => store.get(),

    startAt(x: number, y: number): void {
      active = true;
      nearClose = false;
      points = [[x, y]];
      notify();
    },

    addPoint(x: number, y: number): void {
      if (!active) return;
      points = [...points, [x, y]];
      notify();
    },

    setNearClose(v: boolean): void {
      if (nearClose === v) return;
      nearClose = v;
      notify();
    },

    finish(): void {
      if (active && points.length >= config.minPoints) config.onFinish(points, nearClose);
      active = false;
      nearClose = false;
      points = [];
      notify();
    },

    cancel(): void {
      if (!active && points.length === 0) return;
      active = false;
      nearClose = false;
      points = [];
      notify();
    },

    subscribe: (listener: () => void) => store.subscribe(listener),
  };
}
