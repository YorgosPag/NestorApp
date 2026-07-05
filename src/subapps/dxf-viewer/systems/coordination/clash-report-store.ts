/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-435 Slice 1 — Clash-detection **report store** (LOW-FREQUENCY).
 *
 * Holds the transient {@link ClashReport} currently under review (Revit/Navisworks
 * "Run → review"). Single-writer / multi-reader module-level pub-sub, the exact
 * shape of `mep-design/water/water-proposal-store.ts` — it mutates ONLY on discrete
 * user actions:
 *   - `set(review)` — once, when the ribbon «Έλεγχος Συγκρούσεων» runs the engine.
 *   - `reset()`     — once, on Clear.
 * There is NO per-frame / per-mousemove write, so the overlay leaf subscription is
 * ADR-040-safe (the shell never subscribes — CHECK 6C).
 *
 * Transient by design — never persisted (read-only coordination output).
 *
 * @see ./detect-clashes.ts (producer)
 * @see ../../components/dxf-layout/canvas-layer-stack-clash-overlay.tsx (2D consumer)
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../../stores/createExternalStore';
import type { SceneUnits } from '../../utils/scene-units';
import type { ClashReport } from './clash-types';

/**
 * The report under review plus the scene units it was generated in — the overlay
 * leaf needs `sceneUnits` to convert each clash point (metres) back into canvas
 * units before projecting it to screen.
 */
export interface ClashReportReview {
  readonly report: ClashReport;
  readonly sceneUnits: SceneUnits;
}

// SSoT pub/sub plumbing via createExternalStore (WAVE 2.6). `equals: Object.is`
// reproduces the two identity guards the hand-rolled store used: `set` bails when
// the same review reference is re-set, and `reset()` bails when already idle.
const store = createExternalStore<ClashReportReview | null>(null, { equals: Object.is });

export const clashReportStore = {
  /** Writer — called once by the ribbon bridge when the engine produces a report. */
  set(next: ClashReportReview): void {
    store.set(next);
  },
  /** Clear the report (Clear pressed, or a fresh Detect supersedes it). */
  reset(): void {
    store.set(null);
  },
  /** Non-React reader — for imperative handlers. */
  get(): ClashReportReview | null {
    return store.get();
  },
};

/** React subscription. Returns the report under review, or `null` when idle. */
export function useClashReport(): ClashReportReview | null {
  return useSyncExternalStore(store.subscribe, store.get, () => null);
}
