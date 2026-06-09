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
 * @see ../../bim/mep-segments/../../hooks/tools/useClashOverlayPreview.ts (consumer)
 */

import { useSyncExternalStore } from 'react';
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

type Listener = () => void;

let currentReview: ClashReportReview | null = null;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ClashReportReview | null {
  return currentReview;
}

function getServerSnapshot(): ClashReportReview | null {
  return null;
}

export const clashReportStore = {
  /** Writer — called once by the ribbon bridge when the engine produces a report. */
  set(next: ClashReportReview): void {
    if (currentReview === next) return;
    currentReview = next;
    for (const l of listeners) l();
  },
  /** Clear the report (Clear pressed, or a fresh Detect supersedes it). */
  reset(): void {
    if (currentReview === null) return;
    currentReview = null;
    for (const l of listeners) l();
  },
  /** Non-React reader — for imperative handlers. */
  get(): ClashReportReview | null {
    return currentReview;
  },
};

/** React subscription. Returns the report under review, or `null` when idle. */
export function useClashReport(): ClashReportReview | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
