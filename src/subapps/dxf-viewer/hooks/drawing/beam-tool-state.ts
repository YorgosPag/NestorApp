/**
 * ADR-363 Phase 5 — Beam Tool state machine types + initial state.
 *
 * Extracted from `useBeamTool.ts` (SSoT, N.7.1 file-size split): the
 * orchestrator hook and the commit-handlers hook (`use-beam-commit.ts`) both
 * consume these definitions. Keeping them in a standalone module avoids a
 * circular value import of `INITIAL_STATE` between the two hooks.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7 §6 Phase 5
 */

import type { Point2D } from '../../rendering/types/Types';
import type { BeamKind } from '../../bim/types/beam-types';
import type { BeamParamOverrides } from './beam-completion';

export type BeamToolPhase =
  | 'idle'
  | 'awaitingStart'
  | 'awaitingEnd'
  | 'awaitingCurveControl';

/**
 * Placement mode (ADR-363):
 *   - 'freehand'  — κλασικό 2-click straight/cantilever ή 3-click curved.
 *   - 'from-wall' — «Δοκάρι από τοίχο»: 1 κλικ πάνω σε τοίχο → δοκάρι στον άξονά του.
 */
export type BeamPlacementMode = 'freehand' | 'from-wall';

export interface BeamToolState {
  readonly phase: BeamToolPhase;
  readonly kind: BeamKind;
  readonly placementMode: BeamPlacementMode;
  readonly startPoint: Point2D | null;
  readonly endPoint: Point2D | null;
  readonly overrides: BeamParamOverrides;
  readonly error: string | null;
}

export const INITIAL_STATE: BeamToolState = {
  phase: 'idle',
  kind: 'straight',
  placementMode: 'freehand',
  startPoint: null,
  endPoint: null,
  overrides: {},
  error: null,
};
