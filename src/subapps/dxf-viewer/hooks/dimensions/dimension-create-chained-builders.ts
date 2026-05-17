/**
 * ADR-362 Phase D3 — Baseline + Continued (chained) creation builders.
 *
 * Split out of `dimension-create-entity-builder.ts` so the main dispatcher
 * stays under the 500-LOC Google SRP cap (CLAUDE.md N.7.1). Same public
 * contract as the linear/angular/radial builders: pure
 * `(state, opts) → DimensionEntity | null`.
 *
 * Flow semantics (AutoCAD-aligned, Q-A/B/C/D defaults per ADR-362 §7 Phase D3):
 *   - Baseline (AutoCAD DIMBASELINE): 1 click = new extOrigin2. extOrigin1 +
 *     dimLineRef inherited from `parentDimensionId` at render time by
 *     `chained-builder.ts:buildBaselineGeometry`. Each new baseline dim takes
 *     its immediately-preceding dim as parent (Q-B auto-progression); the
 *     chain walker adds one DIMDLI offset per baseline ancestor so visual
 *     spacing stays predictable.
 *   - Continued (AutoCAD DIMCONTINUE): 1 click = new extOrigin2. New
 *     extOrigin1 = parent's continueOrigin (= its own extOrigin2 after walking
 *     through any continued ancestors). Same dim line — no DIMDLI step.
 *
 * Parent existence is validated by the hook at `start('baseline'|'continued')`
 * time (Q-D silent + console.warn when none). The reducer additionally
 * defends against missing-parent via a click guard. These builders therefore
 * assume `state.parentDimensionId` is non-null at preview / commit time;
 * they return `null` defensively if it isn't (caller renders nothing).
 */

import type { Point2D } from '../../rendering/types/Types';
import type {
  BaselineDimensionEntity,
  ContinuedDimensionEntity,
} from '../../types/dimension';
import type { DimensionCreateState } from './dimension-create-state';

export interface ChainedBuildOpts {
  readonly id: string;
  readonly layerId: string;
  readonly includeCursor: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Builders
// ──────────────────────────────────────────────────────────────────────────────

export function buildBaseline(
  state: DimensionCreateState,
  opts: ChainedBuildOpts,
): BaselineDimensionEntity | null {
  if (!state.parentDimensionId) return null;
  const newExtOrigin = nextExtOrigin(state, opts);
  if (!newExtOrigin) return null;
  return {
    id: opts.id,
    type: 'dimension',
    dimensionType: 'baseline',
    layerId: opts.layerId,
    styleId: state.styleId as string,
    defPoints: [newExtOrigin],
    parentDimensionId: state.parentDimensionId,
  };
}

export function buildContinued(
  state: DimensionCreateState,
  opts: ChainedBuildOpts,
): ContinuedDimensionEntity | null {
  if (!state.parentDimensionId) return null;
  const newExtOrigin = nextExtOrigin(state, opts);
  if (!newExtOrigin) return null;
  return {
    id: opts.id,
    type: 'dimension',
    dimensionType: 'continued',
    layerId: opts.layerId,
    styleId: state.styleId as string,
    defPoints: [newExtOrigin],
    parentDimensionId: state.parentDimensionId,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Click 0 sets the new extension origin. Preview path falls back to the live
 * cursor so the rubber-band entity stays alive while the user moves around
 * before the first commit-ready click.
 */
function nextExtOrigin(state: DimensionCreateState, opts: ChainedBuildOpts): Point2D | null {
  const click = state.clicks[0]?.world;
  if (click) return click;
  if (opts.includeCursor && state.cursorWorld) return state.cursorWorld;
  return null;
}
