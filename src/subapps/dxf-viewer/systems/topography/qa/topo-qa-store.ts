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

/**
 * The report AND which of its flags the engineer is currently looking at.
 *
 * One store, not two: the selection is only ever meaningful against a specific report, and a fresh
 * run must invalidate it. Two stores would need to be kept in step by every caller — the classic
 * way a stale id survives a re-run and highlights a flag that no longer exists.
 */
interface TopoQaReviewState {
  readonly report: TopoQaReport | null;
  /** `TopoQaFlag.id` of the row last clicked, or `null` when nothing is focused. */
  readonly selectedFlagId: string | null;
}

const EMPTY: TopoQaReviewState = { report: null, selectedFlagId: null };

const store = createExternalStore<TopoQaReviewState>(EMPTY, { equals: Object.is });

export const topoQaStore = {
  /** Writer — called once by the panel when `runTopoQa` produces a report. Drops any selection:
   *  flag ids are per-report, so carrying one across a re-run would highlight the wrong finding. */
  set(next: TopoQaReport): void {
    store.set({ report: next, selectedFlagId: null });
  },
  /** Clear the report (Clear pressed, or a fresh run supersedes it). */
  reset(): void {
    store.set(EMPTY);
  },
  /**
   * Focus one flag (row click). The report object is passed through by REFERENCE, so every
   * `useTopoQaReport()` consumer bails out of re-rendering — only the selection readers wake up,
   * and the overlays' `useMemo(…, [report])` world positions are never recomputed on a click.
   */
  select(flagId: string): void {
    store.set({ ...store.get(), selectedFlagId: flagId });
  },
  /** Non-React reader — for imperative handlers. */
  get(): TopoQaReport | null {
    return store.get().report;
  },
  /** Non-React reader for the focused flag — mirror of {@link get}. */
  getSelectedFlagId(): string | null {
    return store.get().selectedFlagId;
  },
};

/** React subscription. Returns the report under review, or `null` when idle. */
export function useTopoQaReport(): TopoQaReport | null {
  return useSyncExternalStore(store.subscribe, () => store.get().report, () => null);
}

/** React subscription for the focused flag's id — the marker + row highlight read this. */
export function useTopoQaSelectedFlagId(): string | null {
  return useSyncExternalStore(store.subscribe, () => store.get().selectedFlagId, () => null);
}
