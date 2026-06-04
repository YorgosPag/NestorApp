/**
 * ADR-408 Φ11 — MEP segment TRIM store (scene-derived, render-time read).
 *
 * Holds the per-segment trim map (`segmentId → {startMm, endMm}`) produced by
 * `resolveSegmentTrims`. The fitting auto-reconciliation host writes it whenever
 * the pipe topology changes; the 2D `MepSegmentRenderer` + 3D `mepSegmentToMesh`
 * read it SYNCHRONOUSLY at draw time (`useMepSegmentTrimStore.getState()`), so a
 * pipe is shortened to butt against its fitting — never crossing it.
 *
 * Derived state only (no Firestore, no persistence). ADR-040-safe: renderers read
 * via `getState()` with zero subscriptions; `version` bumps so any reactive
 * consumer (3D resync) can invalidate.
 *
 * @see ./mep-segment-trim.ts — the pure resolver
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { dequal } from 'dequal';
import type { SegmentTrim } from './mep-segment-trim';

export interface MepSegmentTrimStoreState {
  /** segmentId → trim (mm) at each end. Absent ⇒ no trim. */
  readonly trims: ReadonlyMap<string, SegmentTrim>;
  /** Bumps on every real change — invalidation hook for 3D resync. */
  readonly version: number;
  /** Replace the whole map (referential no-op when deep-equal). */
  setTrims(next: ReadonlyMap<string, SegmentTrim>): void;
  /** Trim for one segment, or null when untrimmed. */
  getTrim(segmentId: string): SegmentTrim | null;
}

function mapsEqual(
  a: ReadonlyMap<string, SegmentTrim>,
  b: ReadonlyMap<string, SegmentTrim>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    const o = b.get(k);
    if (!o || !dequal(v, o)) return false;
  }
  return true;
}

export const useMepSegmentTrimStore = create<MepSegmentTrimStoreState>()(
  subscribeWithSelector((set, get) => ({
    trims: new Map<string, SegmentTrim>(),
    version: 0,
    setTrims: (next) => {
      if (mapsEqual(get().trims, next)) return; // referential-stable no-op (no churn)
      set((s) => ({ trims: next, version: s.version + 1 }));
    },
    getTrim: (segmentId) => get().trims.get(segmentId) ?? null,
  })),
);
