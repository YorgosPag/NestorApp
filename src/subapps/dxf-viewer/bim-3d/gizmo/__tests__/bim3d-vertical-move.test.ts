/**
 * ADR-402 — bim3d-vertical-move: gizmo axis-Y drag → per-type elevation patch.
 *
 * Pure, no mocks. Verifies that the vertical move bumps each element's CANONICAL
 * elevation field (ADR-369, all positive-up) by the mm drag delta, that the stair
 * delta is converted into its drawing-unit space, and that a zero drag is a no-op.
 */

import {
  computeWallVerticalMove,
  computeColumnVerticalMove,
  computeBeamVerticalMove,
  computeSlabVerticalMove,
  computeStairVerticalMove,
} from '../bim3d-vertical-move';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import { buildDefaultWallParams } from '../../../hooks/drawing/wall-completion';
import { buildDefaultBeamParams } from '../../../hooks/drawing/beam-completion';
import { buildDefaultSlabParams } from '../../../hooks/drawing/slab-completion';
import { buildDefaultStairParams, buildStairEntity } from '../../../hooks/drawing/stair-completion';
import { mmToSceneUnits, inferSceneUnitsFromWidth } from '../../../utils/scene-units';

const wall = () => buildDefaultWallParams({ x: 0, y: 0 }, { x: 3000, y: 0 });
const column = () => buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular');
const beam = () => buildDefaultBeamParams({ x: 0, y: 0 }, { x: 3000, y: 0 });
const slab = () =>
  buildDefaultSlabParams([
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 1000 },
    { x: 0, y: 1000 },
  ]);
const stair = () => buildStairEntity(buildDefaultStairParams({ x: 0, y: 0 }, 0), '0');

describe('computeWallVerticalMove', () => {
  it('drag up → baseOffset += Δmm (whole wall lifts)', () => {
    const p = wall();
    const next = computeWallVerticalMove(p, 500);
    expect(next).not.toBeNull();
    expect(next!.baseOffset).toBe(p.baseOffset + 500);
    // dimensions untouched — it is a move, not a resize.
    expect(next!.height).toBe(p.height);
    expect(next!.thickness).toBe(p.thickness);
  });
  it('drag down → baseOffset decreases', () => {
    const p = wall();
    expect(computeWallVerticalMove(p, -300)!.baseOffset).toBe(p.baseOffset - 300);
  });
  it('zero delta → null (no empty undo step)', () => {
    expect(computeWallVerticalMove(wall(), 0)).toBeNull();
  });
});

describe('computeColumnVerticalMove', () => {
  it('drag up → baseOffset += Δmm', () => {
    const p = column();
    const next = computeColumnVerticalMove(p, 250);
    expect(next!.baseOffset).toBe(p.baseOffset + 250);
    expect(next!.height).toBe(p.height);
  });
  it('zero delta → null', () => {
    expect(computeColumnVerticalMove(column(), 0)).toBeNull();
  });
});

describe('computeBeamVerticalMove', () => {
  it('drag up → topElevation += Δmm (depth fixed)', () => {
    const p = beam();
    const next = computeBeamVerticalMove(p, 400);
    expect(next!.topElevation).toBe(p.topElevation + 400);
    expect(next!.depth).toBe(p.depth);
  });
  it('zero delta → null', () => {
    expect(computeBeamVerticalMove(beam(), 0)).toBeNull();
  });
});

describe('computeSlabVerticalMove', () => {
  it('drag up → levelElevation += Δmm (thickness fixed)', () => {
    const p = slab();
    const next = computeSlabVerticalMove(p, 150);
    expect(next!.levelElevation).toBe(p.levelElevation + 150);
    expect(next!.thickness).toBe(p.thickness);
  });
  it('zero delta → null', () => {
    expect(computeSlabVerticalMove(slab(), 0)).toBeNull();
  });
});

describe('computeStairVerticalMove (drawing-unit aware)', () => {
  it('drag up → basePoint.z += Δ converted to the stair drawing-unit space', () => {
    const e = stair();
    const z0 = e.params.basePoint.z;
    const next = computeStairVerticalMove(e, 1000);
    expect(next).not.toBeNull();
    const scenePerMm = mmToSceneUnits(inferSceneUnitsFromWidth(e.params.width));
    expect(next!.basePoint.z).toBeCloseTo(z0 + 1000 * scenePerMm, 6);
    // x / y of the base point are untouched (pure vertical move).
    expect(next!.basePoint.x).toBe(e.params.basePoint.x);
    expect(next!.basePoint.y).toBe(e.params.basePoint.y);
  });
  it('zero delta → null', () => {
    expect(computeStairVerticalMove(stair(), 0)).toBeNull();
  });
});
