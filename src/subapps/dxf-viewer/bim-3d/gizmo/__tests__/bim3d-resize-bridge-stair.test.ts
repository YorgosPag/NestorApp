/**
 * `computeStairResizeParams`: gizmo resize drag → new `StairParams`.
 *
 * Pure, no mocks. Verifies:
 *   - ADR-402 Sub-Phase 1 (plan X/Z): the slide projects onto the stair's LOCAL
 *     frame and the DOMINANT component drives one dimension (perp → width, axial →
 *     run/stepCount); width grows ±2·perp; run SNAPS to whole steps (stepCount
 *     changes, tread constant — Revit "add/remove risers"); sub-step drag → null;
 *   - ADR-401 Phase G.3 (axis-Y): TOP grip grows totalRise + re-steps (base fixed),
 *     BASE grip lifts the base + shrinks totalRise + re-steps; dragging an attached
 *     side detaches it first (edit breaks attach); zero delta → null.
 */

import { computeStairResizeParams } from '../bim3d-resize-bridge';
import type { ResizeDragMm } from '../bim3d-resize-bridge';
import type { GizmoResizeMode } from '../gizmo-types';
import {
  buildDefaultStairParams,
  buildStairEntity,
} from '../../../hooks/drawing/stair-completion';
import { mmToSceneUnits, inferSceneUnitsFromWidth } from '../../../utils/scene-units';
import type { StairEntity, StairParams } from '../../../bim/types/stair-types';

/** Straight stair climbing along +X (direction 0 → u=(1,0), perp=(0,1)). */
function straightStair(overrides: Partial<StairParams> = {}): StairEntity {
  return buildStairEntity({ ...buildDefaultStairParams({ x: 0, y: 0 }, 0), ...overrides }, '0');
}

function drag(
  axis: ResizeDragMm['axis'],
  deltaMm: { x: number; y: number },
  deltaUpMm = 0,
  mode: GizmoResizeMode = 'normal',
): ResizeDragMm {
  return { axis, mode, deltaMm, deltaUpMm, cursorMm: deltaMm };
}

describe('computeStairResizeParams (ADR-402 Sub-Phase 1)', () => {
  it('perpendicular drag → width grows opposite-face-fixed, base recenters by half (ADR-393 Phase C wall parity)', () => {
    const stair = straightStair();
    const w0 = stair.params.width;
    const base0 = stair.params.basePoint.y;
    // deltaMm perpendicular to the climb axis (y) → dominant perp component → width.
    const next = computeStairResizeParams(stair, drag('z', { x: 0, y: 25 }));
    expect(next).not.toBeNull();
    const scenePerMm = mmToSceneUnits(inferSceneUnitsFromWidth(w0));
    // A straight (rect) stair's `stair-width` grip is intercepted by the shared
    // axis-box engine BEFORE it ever reaches the standalone `resizeWidth` (ADR-393
    // Phase C, `applyRectStairGrip` → `applyRectEdgeDrag`): the far face is held
    // FIXED and the dragged face moves by the perp delta ×1 — NOT the legacy
    // symmetric ×2 `resizeWidth` still uses for non-rect variants. Same "wall
    // parity" contract already locked in by `stair-grips.test.ts` #12 ("opposite-
    // face-fixed width grow + axis recenter"). The centreline (`basePoint`) shifts
    // by HALF the width delta toward the dragged face so the far edge stays put.
    expect(next!.width).toBeCloseTo(w0 + 25 * scenePerMm, 6);
    expect(next!.width).toBeGreaterThan(w0);
    expect(next!.basePoint.y).toBeCloseTo(base0 + 12.5 * scenePerMm, 6);
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

  it('zero delta → null (no-op)', () => {
    expect(computeStairResizeParams(straightStair(), drag('x', { x: 0, y: 0 }))).toBeNull();
  });
});

describe('computeStairResizeParams axis-Y (ADR-401 Phase G.3 — Revit risers)', () => {
  it('TOP grip (normal) → totalRise grows, step COUNT increases, base fixed', () => {
    const stair = straightStair();
    const { totalRise, stepCount, basePoint } = stair.params;
    const next = computeStairResizeParams(stair, drag('y', { x: 0, y: 0 }, 1000, 'normal'));
    expect(next).not.toBeNull();
    expect(next!.totalRise).toBeCloseTo(totalRise + 1000, 6);
    expect(next!.stepCount).toBeGreaterThan(stepCount);
    expect(next!.basePoint.z).toBeCloseTo(basePoint.z, 6); // base stays put
    // re-stepped to equal risers that exactly fill the new totalRise.
    expect(next!.rise * next!.stepCount).toBeCloseTo(next!.totalRise, 6);
  });

  it('BASE grip (mirror) → base lifts by Δ, totalRise shrinks, re-steps', () => {
    const stair = straightStair();
    const { totalRise, basePoint } = stair.params;
    const next = computeStairResizeParams(stair, drag('y', { x: 0, y: 0 }, 500, 'mirror'));
    expect(next).not.toBeNull();
    expect(next!.basePoint.z).toBeCloseTo(basePoint.z + 500, 6);
    expect(next!.totalRise).toBeCloseTo(totalRise - 500, 6);
    expect(next!.rise * next!.stepCount).toBeCloseTo(next!.totalRise, 6);
  });

  it('dragging an ATTACHED top detaches it first (edit breaks attach)', () => {
    const stair = straightStair({ topBinding: 'attached', attachTopToIds: ['beam_1'] });
    const next = computeStairResizeParams(stair, drag('y', { x: 0, y: 0 }, 1000, 'normal'));
    expect(next).not.toBeNull();
    expect(next!.topBinding).toBe('unconnected');
    expect(next!.attachTopToIds).toBeUndefined();
  });

  it('dragging an ATTACHED base detaches it first (edit breaks attach)', () => {
    const stair = straightStair({ baseBinding: 'attached', attachBaseToIds: ['slab_1'] });
    const next = computeStairResizeParams(stair, drag('y', { x: 0, y: 0 }, 300, 'mirror'));
    expect(next).not.toBeNull();
    expect(next!.baseBinding).toBe('storey-floor');
    expect(next!.attachBaseToIds).toBeUndefined();
  });

  it('zero vertical delta → null (no-op)', () => {
    expect(computeStairResizeParams(straightStair(), drag('y', { x: 0, y: 0 }, 0))).toBeNull();
  });
});
