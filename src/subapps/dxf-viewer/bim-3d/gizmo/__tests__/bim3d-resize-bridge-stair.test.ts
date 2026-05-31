/**
 * ADR-402 Sub-Phase 1 — `computeStairResizeParams`: gizmo resize drag → new
 * `StairParams`, reusing the 2D stair grip-drag SSoT (`applyStairGripDrag`).
 *
 * Pure, no mocks. Verifies:
 *   - the plan slide is projected onto the stair's LOCAL frame and the DOMINANT
 *     component drives a single dimension (perp → width, axial → run/stepCount);
 *   - width grows symmetrically (±2·perp) from the gizmo's relative drag;
 *   - run drag SNAPS to whole steps (stepCount changes, tread constant — Revit
 *     "add / remove risers"), and a sub-step drag is treated as a no-op (`null`);
 *   - axis-Y is not a stair resize (`null`); zero delta is a no-op (`null`).
 */

import { computeStairResizeParams } from '../bim3d-resize-bridge';
import type { ResizeDragMm } from '../bim3d-resize-bridge';
import {
  buildDefaultStairParams,
  buildStairEntity,
} from '../../../hooks/drawing/stair-completion';
import { mmToSceneUnits, inferSceneUnitsFromWidth } from '../../../utils/scene-units';
import type { StairEntity } from '../../../bim/types/stair-types';

/** Straight stair climbing along +X (direction 0 → u=(1,0), perp=(0,1)). */
function straightStair(): StairEntity {
  return buildStairEntity(buildDefaultStairParams({ x: 0, y: 0 }, 0), '0');
}

function drag(
  axis: ResizeDragMm['axis'],
  deltaMm: { x: number; y: number },
  deltaUpMm = 0,
): ResizeDragMm {
  return { axis, mode: 'normal', deltaMm, deltaUpMm, cursorMm: deltaMm };
}

describe('computeStairResizeParams (ADR-402 Sub-Phase 1)', () => {
  it('perpendicular drag → width grows symmetrically (±2·perp)', () => {
    const stair = straightStair();
    const w0 = stair.params.width;
    // deltaMm perpendicular to the climb axis (y) → dominant perp component → width.
    const next = computeStairResizeParams(stair, drag('z', { x: 0, y: 25 }));
    expect(next).not.toBeNull();
    const scenePerMm = mmToSceneUnits(inferSceneUnitsFromWidth(w0));
    expect(next!.width).toBeCloseTo(w0 + 2 * 25 * scenePerMm, 6);
    expect(next!.width).toBeGreaterThan(w0);
    // a width drag must not touch the run.
    expect(next!.stepCount).toBe(stair.params.stepCount);
    expect(next!.totalRun).toBeCloseTo(stair.params.totalRun, 6);
  });

  it('axial drag → run grows by whole steps (tread constant)', () => {
    const stair = straightStair();
    const { tread, stepCount, totalRun } = stair.params;
    // A large axial slide (along +X) crosses several tread boundaries.
    const next = computeStairResizeParams(stair, drag('x', { x: 2000, y: 0 }));
    expect(next).not.toBeNull();
    expect(next!.stepCount).toBeGreaterThan(stepCount);
    expect(next!.totalRun).toBeGreaterThan(totalRun);
    // tread (going) is preserved — Revit adds risers, it does not stretch them.
    expect(next!.tread).toBeCloseTo(tread, 6);
    // run is an integer number of treads.
    expect(next!.totalRun).toBeCloseTo(tread * (next!.stepCount - 1), 6);
    // an axial drag must not touch the width.
    expect(next!.width).toBeCloseTo(stair.params.width, 6);
  });

  it('axial drag below one tread → no-op (null, no empty undo step)', () => {
    const stair = straightStair();
    // A slide far smaller than one tread snaps back to the same run.
    const next = computeStairResizeParams(stair, drag('x', { x: 1, y: 0 }));
    expect(next).toBeNull();
  });

  it('dominant component decides: a mostly-axial diagonal drives the run, not width', () => {
    const stair = straightStair();
    const next = computeStairResizeParams(stair, drag('x', { x: 2000, y: 10 }));
    expect(next).not.toBeNull();
    expect(next!.width).toBeCloseTo(stair.params.width, 6); // width untouched
    expect(next!.stepCount).toBeGreaterThan(stair.params.stepCount);
  });

  it('axis-Y → null (height = rise × stepCount is panel-only)', () => {
    expect(computeStairResizeParams(straightStair(), drag('y', { x: 0, y: 0 }, 500))).toBeNull();
  });

  it('zero delta → null (no-op)', () => {
    expect(computeStairResizeParams(straightStair(), drag('x', { x: 0, y: 0 }))).toBeNull();
  });
});
