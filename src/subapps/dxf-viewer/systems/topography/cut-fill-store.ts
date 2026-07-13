/**
 * ADR-650 M6 — CutFillStore: the earthworks QUESTION and its last ANSWER.
 *
 * Split from `TopoPointStore` on the same principle M4 used for the display store: that one
 * owns the survey DEFINITION, this one owns what we ASK of it (against which reference, at
 * which level) and what came back. Changing the design level must never touch the survey.
 *
 * Staleness is handled the way Civil 3D handles it — an answer computed against a survey that
 * has since changed is WRONG, so any edit to the topography clears the result rather than
 * leaving a number on screen that no longer matches the ground. The user re-runs; they never
 * read a stale volume.
 *
 * Pattern: `createExternalStore` vanilla store (ADR-040). Zero React state.
 */

import { createExternalStore } from '../../stores/createExternalStore';
import { getTopoBoundary, subscribeTopo } from './TopoPointStore';
import { getTopoSurface } from './topo-surface';
import {
  computeCutFill,
  datumReference,
  surfaceReference,
  type ElevationReference,
} from './cut-fill';
import { crossCheckCutFill, type CutFillCrossCheck } from './cut-fill-crosscheck';
import type { CutFillReferenceMode, CutFillResult } from './topo-types';

/** Why an earthworks run could not produce an answer — surfaced to the user, never swallowed. */
export type CutFillError = 'no-surface' | 'no-proposed-surface';

export interface CutFillState {
  readonly mode: CutFillReferenceMode;
  /** The design level in canonical mm (datum mode). */
  readonly datumZMm: number;
  readonly result: CutFillResult | null;
  readonly crossCheck: CutFillCrossCheck | null;
  readonly error: CutFillError | null;
}

const INITIAL: CutFillState = {
  mode: 'datum',
  datumZMm: 0,
  result: null,
  crossCheck: null,
  error: null,
};

const store = createExternalStore<CutFillState>(INITIAL);

// The survey moved → every previously computed volume is now a lie. Drop it.
subscribeTopo(() => {
  const current = store.get();
  if (current.result === null && current.error === null) return;
  store.set({ ...current, result: null, crossCheck: null, error: null });
});

// ─── Reads ─────────────────────────────────────────────────────────────────────

/** Full snapshot (safe as a `useSyncExternalStore` getSnapshot — stable while unchanged). */
export function getCutFillState(): CutFillState {
  return store.get();
}

/** Subscribe to earthworks state changes; returns unsubscribe. */
export function subscribeCutFill(listener: () => void): () => void {
  return store.subscribe(listener);
}

/**
 * The reference the current settings describe, or `null` when the surface road is selected but
 * no proposed ground has been imported yet. This is the ONE place mode → reference is resolved,
 * so the 3D cut/fill shading and the volume table can never disagree about what they compare to.
 */
export function resolveCutFillReference(): ElevationReference | null {
  const { mode, datumZMm } = store.get();
  if (mode === 'datum') return datumReference(datumZMm);

  const proposed = getTopoSurface('proposed');
  return proposed.triangles.length > 0 ? surfaceReference(proposed) : null;
}

// ─── Writes ────────────────────────────────────────────────────────────────────

/** Datum («σκάψε μέχρι το +12.50») ↔ designed surface. Clears the previous answer. */
export function setCutFillMode(mode: CutFillReferenceMode): void {
  const current = store.get();
  if (current.mode === mode) return;
  store.set({ ...current, mode, result: null, crossCheck: null, error: null });
}

/** The design level, canonical mm. Clears the previous answer (it was for another level). */
export function setCutFillDatumZMm(datumZMm: number): void {
  const current = store.get();
  const next = Number.isFinite(datumZMm) ? datumZMm : 0;
  if (current.datumZMm === next) return;
  store.set({ ...current, datumZMm: next, result: null, crossCheck: null, error: null });
}

/**
 * Run the earthworks: prism method for the answer, grid method for the second opinion.
 * Writes the outcome into the store and returns it, so the caller can react without a
 * subscription round-trip.
 */
export function runCutFill(): CutFillState {
  const current = store.get();
  const ground = getTopoSurface('existing');
  if (ground.triangles.length === 0) {
    const next = { ...current, result: null, crossCheck: null, error: 'no-surface' as const };
    store.set(next);
    return next;
  }

  const reference = resolveCutFillReference();
  if (!reference) {
    const next = { ...current, result: null, crossCheck: null, error: 'no-proposed-surface' as const };
    store.set(next);
    return next;
  }

  const boundary = getTopoBoundary();
  const result = computeCutFill(ground, reference, boundary);
  const crossCheck = crossCheckCutFill(ground, reference, boundary, result);
  const next: CutFillState = { ...current, result, crossCheck, error: null };
  store.set(next);
  return next;
}
