/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-650 M8β/Γ — auto-breakline **review store** (LOW-FREQUENCY).
 *
 * Holds the proposals currently under review plus WHICH ONES the engineer has ticked — the
 * «Run → review → approve» shape of its sibling `qa/topo-qa-store.ts`, with the one thing QA
 * does not need: a selection. Nothing here is the survey; the survey changes only when the
 * panel calls `acceptAutoBreaklines` (§9 — human-certifier).
 *
 * Single-writer / multi-reader module-level pub-sub, mutated ONLY on discrete user actions
 * (run · tick a row · tick all · add · clear) — never per frame, never per mousemove. So the
 * 2D preview overlay may subscribe to it as a leaf without violating ADR-040 (the canvas shell
 * never does — CHECK 6C). Transient by design, never persisted.
 *
 * @see ./index.ts (producer + the only writer to the survey)
 * @see ../../../components/dxf-layout/TopoAutoBreaklinePreviewOverlay.tsx (2D consumer)
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../../../stores/createExternalStore';
import type { AutoBreaklineCandidate, AutoBreaklineReport } from './auto-breakline-types';

/** The review session: the proposals, and the ones ticked for adding. */
export interface AutoBreaklineState {
  readonly report: AutoBreaklineReport | null;
  readonly selected: ReadonlySet<string>;
}

const EMPTY: AutoBreaklineState = { report: null, selected: new Set() };

const store = createExternalStore<AutoBreaklineState>(EMPTY, { equals: Object.is });

/** The candidates the engineer currently has ticked (report order preserved). */
export function selectedCandidates(state: AutoBreaklineState): readonly AutoBreaklineCandidate[] {
  return state.report?.candidates.filter((c) => state.selected.has(c.id)) ?? [];
}

export const autoBreaklineStore = {
  /**
   * A fresh pass supersedes the previous one. Candidates arrive TICKED (Civil 3D's «Extract
   * objects from surface» preselects what it found) — the engineer unticks what he rejects and
   * presses Add. Nothing is written until he does.
   */
  setReport(report: AutoBreaklineReport): void {
    store.set({ report, selected: new Set(report.candidates.map((c) => c.id)) });
  },

  /** Tick / untick one proposal. */
  toggle(id: string): void {
    const { report, selected } = store.get();
    if (report === null) return;
    const next = new Set(selected);
    if (!next.delete(id)) next.add(id);
    store.set({ report, selected: next });
  },

  /** Tick or untick every proposal at once. */
  setAll(ticked: boolean): void {
    const { report } = store.get();
    if (report === null) return;
    store.set({ report, selected: ticked ? new Set(report.candidates.map((c) => c.id)) : new Set() });
  },

  /** Clear the review (Clear pressed, or the approved ones have just been added). */
  reset(): void {
    store.set(EMPTY);
  },

  /** Non-React reader — for imperative handlers. */
  get(): AutoBreaklineState {
    return store.get();
  },
};

/** React subscription. Returns the review session (`report: null` when idle). */
export function useAutoBreaklineState(): AutoBreaklineState {
  return useSyncExternalStore(store.subscribe, store.get, () => EMPTY);
}
