/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-650 M8β/Γ — auto-breakline **review store** (LOW-FREQUENCY).
 *
 * Holds the proposals currently under review plus WHICH ONES the engineer has ticked — the
 * «Run → review → approve» shape of its sibling `qa/topo-qa-store.ts`, with the one thing QA
 * does not need: an approval set. Nothing here is the survey; the survey changes only when the
 * panel calls `acceptAutoBreaklines` (§9 — human-certifier).
 *
 * Single-writer / multi-reader module-level pub-sub, mutated ONLY on discrete user actions
 * (run · tick a row · tick all · click a row · add · clear) — never per frame, never per
 * mousemove. So the 2D preview overlay and the 3D candidate layer may subscribe to it as leaves
 * without violating ADR-040 (the canvas shell never does — CHECK 6C). Transient, never persisted.
 *
 * @see ./index.ts (producer + the only writer to the survey)
 * @see ../../../components/dxf-layout/TopoAutoBreaklinePreviewOverlay.tsx (2D consumer)
 * @see ../../../bim-3d/scene/terrain/TopoAutoBreaklineCandidateLayer.ts (3D consumer)
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../../../stores/createExternalStore';
import type { AutoBreaklineCandidate, AutoBreaklineReport } from './auto-breakline-types';

/**
 * The review session. TWO independent per-candidate marks live here, and confusing them is the
 * easiest way to break this panel, so the names are deliberately not siblings:
 *
 *   - `selected` — «θα μπει στην αποτύπωση». The engineer's APPROVAL, many at a time, driven by
 *     the checkboxes, and the only thing `acceptAutoBreaklines` ever reads.
 *   - `focusedId` — «αυτήν κοιτάω τώρα». Exactly one at a time, driven by clicking the row, and
 *     purely a review aid: it moves the view and makes that one candidate stand out. It NEVER
 *     decides what gets written.
 *
 * A candidate can be approved and not focused, focused and rejected, or both — all four states
 * are meaningful, which is precisely why one flag could not have served for both.
 */
export interface AutoBreaklineState {
  readonly report: AutoBreaklineReport | null;
  /** Ids ticked for adding (approval). */
  readonly selected: ReadonlySet<string>;
  /** Id of the candidate the engineer last clicked, or `null` when nothing is under inspection. */
  readonly focusedId: string | null;
}

const EMPTY: AutoBreaklineState = { report: null, selected: new Set(), focusedId: null };

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
    // `focusedId` drops with the pass: candidate ids are per-report review keys, so carrying one
    // across a re-run would highlight a candidate that no longer exists — the same reason
    // `topoQaStore.set` drops its selected flag.
    store.set({ report, selected: new Set(report.candidates.map((c) => c.id)), focusedId: null });
  },

  /** Tick / untick one proposal. Approval only — what the engineer is LOOKING at does not move. */
  toggle(id: string): void {
    const state = store.get();
    if (state.report === null) return;
    const next = new Set(state.selected);
    if (!next.delete(id)) next.add(id);
    store.set({ ...state, selected: next });
  },

  /** Tick or untick every proposal at once. */
  setAll(ticked: boolean): void {
    const state = store.get();
    const { report } = state;
    if (report === null) return;
    store.set({ ...state, selected: ticked ? new Set(report.candidates.map((c) => c.id)) : new Set() });
  },

  /**
   * Mark the candidate the engineer is inspecting (row click). `report` and `selected` are passed
   * through by REFERENCE, so consumers that memoise on them (the 3D layer's geometry inputs, the
   * approval list) bail out — only the highlight repaints. Approval is untouched: clicking a row
   * must never tick or untick it, or reviewing the list would silently rewrite the outcome.
   */
  focus(id: string): void {
    store.set({ ...store.get(), focusedId: id });
  },

  /** Clear the review (Clear pressed, or the approved ones have just been added). */
  reset(): void {
    store.set(EMPTY);
  },

  /** Non-React reader — for imperative handlers. */
  get(): AutoBreaklineState {
    return store.get();
  },

  /** Non-React reader for the inspected candidate — mirror of {@link get}. */
  getFocusedId(): string | null {
    return store.get().focusedId;
  },
};

/** React subscription. Returns the review session (`report: null` when idle). */
export function useAutoBreaklineState(): AutoBreaklineState {
  return useSyncExternalStore(store.subscribe, store.get, () => EMPTY);
}

/**
 * Non-React subscription — for the imperative 3D scene layer, which has no React tree to live in.
 * Mirror of `subscribeTopo` / `subscribeTerrain3D`, so the layer's subscription set stays uniform.
 */
export function subscribeAutoBreakline(listener: () => void): () => void {
  return store.subscribe(listener);
}
