/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-650 M5α — Topography QA **report store** (LOW-FREQUENCY).
 *
 * Holds the transient {@link TopoQaReport} currently under review — the exact «Run → review»
 * shape of `systems/coordination/clash-report-store.ts` (its sibling). Single-writer /
 * multi-reader module-level pub-sub that mutates ONLY on discrete user actions:
 *   - `set(report)` — once, when the panel's «Έλεγχος ποιότητας» runs `runTopoQa`.
 *   - `reset()`     — once, on Clear (or when a fresh run supersedes it).
 * No per-frame / per-mousemove write, so the marker overlay leaf subscription is ADR-040-safe
 * (the canvas shell never subscribes — CHECK 6C). Transient by design, never persisted.
 *
 * @see ./run-topo-qa.ts (producer)
 * @see ../../../components/dxf-layout/canvas-layer-stack-topo-qa-overlay.tsx (2D consumer)
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../../../stores/createExternalStore';
import type { TopoQaReport } from './topo-qa-types';

const store = createExternalStore<TopoQaReport | null>(null, { equals: Object.is });

export const topoQaStore = {
  /** Writer — called once by the panel when `runTopoQa` produces a report. */
  set(next: TopoQaReport): void {
    store.set(next);
  },
  /** Clear the report (Clear pressed, or a fresh run supersedes it). */
  reset(): void {
    store.set(null);
  },
  /** Non-React reader — for imperative handlers. */
  get(): TopoQaReport | null {
    return store.get();
  },
};

/** React subscription. Returns the report under review, or `null` when idle. */
export function useTopoQaReport(): TopoQaReport | null {
  return useSyncExternalStore(store.subscribe, store.get, () => null);
}
