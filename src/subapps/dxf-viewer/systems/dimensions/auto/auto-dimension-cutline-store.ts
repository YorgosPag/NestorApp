/**
 * ADR-563 Φ4-Α (Auto-Dimension) — interactive cut-line session store.
 *
 * Zero-React module singleton (ADR-040 leaf — read via getters at event/RAF time,
 * never via `useSyncExternalStore`). Holds the 3-click FSM for the cut-line tool:
 *
 *   idle → (arm on tool activate + dialog) → awaitingStart
 *        → click1 → awaitingEnd → click2 → awaitingPlacement
 *        → click3 (commit) → awaitingStart  (ArchiCAD continuous — Esc exits)
 *
 * The click handler (`advanceCutlineClick`, run-cutline-dimension.ts) and the
 * preview RAF callback (`useAutoDimCutlineTool`) both read/write this one store,
 * so preview and commit stay byte-identical.
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { AutoDimensionOptions } from './auto-dimension-types';

export type CutlinePhase = 'idle' | 'awaitingStart' | 'awaitingEnd' | 'awaitingPlacement';

export interface CutlineSession {
  readonly phase: CutlinePhase;
  /** Dialog options captured at arm time (null while idle). */
  readonly options: AutoDimensionOptions | null;
  /** First click — cut-line start (world mm, snapped). */
  readonly cutStart: Point2D | null;
  /** Second click — cut-line end (world mm, snapped). */
  readonly cutEnd: Point2D | null;
}

const IDLE: CutlineSession = { phase: 'idle', options: null, cutStart: null, cutEnd: null };

let session: CutlineSession = IDLE;

export function getCutlineSession(): CutlineSession {
  return session;
}

/** Arm the tool after the options dialog resolves — ready for the first click. */
export function armCutline(options: AutoDimensionOptions): void {
  session = { phase: 'awaitingStart', options, cutStart: null, cutEnd: null };
}

/** Reset to idle (tool deactivated / cancelled). */
export function resetCutline(): void {
  session = IDLE;
}

/** Record click 1. No-op unless awaiting the start. */
export function setCutlineStart(p: Point2D): void {
  if (session.phase !== 'awaitingStart') return;
  session = { ...session, phase: 'awaitingEnd', cutStart: p };
}

/** Record click 2 → enter placement (offset) phase. No-op unless awaiting the end. */
export function setCutlineEnd(p: Point2D): void {
  if (session.phase !== 'awaitingEnd') return;
  session = { ...session, phase: 'awaitingPlacement', cutEnd: p };
}

/** After a commit — keep the options, begin a fresh cut line (continuous tool). */
export function rearmCutline(): void {
  session = session.options
    ? { phase: 'awaitingStart', options: session.options, cutStart: null, cutEnd: null }
    : IDLE;
}
