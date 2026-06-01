/**
 * ADR-404 Phase 2 — bim3d-tilt-bridge: gizmo X/Z rotate-ring drag → new entity params.
 *
 * Pure, no mocks. Verifies:
 *   - the magnetic angle snap (15° multiples via the SSoT + the standalone 5°);
 *   - column tilt → `tilt {direction, angle}` (set-per-plane, raking any direction);
 *   - wall tilt → `tilt {angle}` ⟂ run; the ⟂-run ring is a roll → no-op;
 *   - beam tilt → `topElevationEnd` ramp; the ∥-run ring is a roll → no-op;
 *   - slab tilt → `geometryType:'tilted' + slope {direction, angle%}`;
 *   - a near-zero drag straightens the element (drops the tilt field);
 *   - no-op short-circuits to `null`.
 */

import {
  snapTiltAngleDeg,
  computeColumnTiltParams,
  computeWallTiltParams,
  computeBeamTiltParams,
  computeSlabTiltParams,
  type TiltDragDeg,
} from '../bim3d-tilt-bridge';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import { buildDefaultWallParams } from '../../../hooks/drawing/wall-completion';
import { buildDefaultBeamParams } from '../../../hooks/drawing/beam-completion';
import { buildDefaultSlabParams } from '../../../hooks/drawing/slab-completion';
import type { ColumnParams } from '../../../bim/types/column-types';

function rect(overrides: Partial<ColumnParams> = {}): ColumnParams {
  return { ...buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), ...overrides };
}
/** Wall along world X → axis (1,0), left-perp (0,1). The X-ring tilts it; Z = roll. */
function wallAlongX() {
  return buildDefaultWallParams({ x: 0, y: 0 }, { x: 3000, y: 0 });
}
/** Beam along world X → the Z-ring (⟂ run) ramps it; the X-ring is a roll. */
function beamAlongX() {
  return buildDefaultBeamParams({ x: 0, y: 0 }, { x: 3000, y: 0 });
}
function squareSlab() {
  return buildDefaultSlabParams([
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 1000 },
    { x: 0, y: 1000 },
  ]);
}
function tilt(axis: 'x' | 'z', angleDeg: number): TiltDragDeg {
  return { axis, angleDeg };
}

describe('snapTiltAngleDeg', () => {
  it('snaps near a 15° multiple', () => {
    expect(snapTiltAngleDeg(14)).toBeCloseTo(15, 6);
    expect(snapTiltAngleDeg(29)).toBeCloseTo(30, 6);
    expect(snapTiltAngleDeg(-44)).toBeCloseTo(-45, 6);
  });
  it('snaps near the standalone 5° increment', () => {
    expect(snapTiltAngleDeg(5.5)).toBeCloseTo(5, 6);
    expect(snapTiltAngleDeg(-6)).toBeCloseTo(-5, 6);
  });
  it('stays free between snap candidates', () => {
    expect(snapTiltAngleDeg(22)).toBeCloseTo(22, 6); // 7° from 15, 8° from 30
    expect(snapTiltAngleDeg(-10)).toBeCloseTo(-10, 6); // 5° from both 5 and 15
  });
});

describe('computeColumnTiltParams — raking, set-per-plane', () => {
  it('X-ring → lean in plan-Y (direction 270 for +angle), magnitude = drag', () => {
    const next = computeColumnTiltParams(rect(), tilt('x', 15));
    expect(next?.tilt).toEqual({ direction: 270, angle: 15 });
  });
  it('Z-ring → lean in plan-X; sign of the drag flips the direction 180°', () => {
    const next = computeColumnTiltParams(rect(), tilt('z', -30));
    expect(next?.tilt).toEqual({ direction: 0, angle: 30 });
  });
  it('a near-vertical drag straightens the column (drops tilt)', () => {
    const next = computeColumnTiltParams(rect({ tilt: { direction: 90, angle: 10 } }), tilt('x', 0));
    expect(next).not.toBeNull();
    expect(next?.tilt).toBeUndefined();
  });
  it('returns null for an already-vertical column dragged to ~0', () => {
    expect(computeColumnTiltParams(rect(), tilt('x', 0))).toBeNull();
  });
});

describe('computeWallTiltParams — battered, ⟂ run (1 DOF)', () => {
  it('the in-line ring (X for an X-wall) tilts; magnitude = drag, side from perp sign', () => {
    const next = computeWallTiltParams(wallAlongX(), tilt('x', 15));
    expect(next?.tilt?.angle).toBeCloseTo(-15, 6); // left-perp (0,1) ⇒ sign(c=-1) flips
  });
  it('the perpendicular ring (Z for an X-wall) is a roll → no-op', () => {
    expect(computeWallTiltParams(wallAlongX(), tilt('z', 15))).toBeNull();
  });
  it('straightens when dragged back to ~0', () => {
    const start = { ...wallAlongX(), tilt: { angle: 12 } };
    const next = computeWallTiltParams(start, tilt('x', 0));
    expect(next).not.toBeNull();
    expect(next?.tilt).toBeUndefined();
  });
});

describe('computeBeamTiltParams — ramp along the axis', () => {
  it('the ⟂-run ring (Z for an X-beam) ramps topElevationEnd by run·tan(angle)', () => {
    const beam = beamAlongX();
    const next = computeBeamTiltParams(beam, tilt('z', 15));
    // k = -bx/run = -1 ⇒ tip = -15°; ΔEnd = 3000·tan(-15°) ≈ -803.8mm.
    expect(next?.topElevationEnd).toBeCloseTo(beam.topElevation + 3000 * Math.tan((-15 * Math.PI) / 180), 3);
  });
  it('the ∥-run ring (X for an X-beam) is a roll → no-op', () => {
    expect(computeBeamTiltParams(beamAlongX(), tilt('x', 15))).toBeNull();
  });
  it('flattens when dragged back to ~0', () => {
    const beam = beamAlongX();
    const sloped = { ...beam, topElevationEnd: beam.topElevation + 500 };
    const next = computeBeamTiltParams(sloped, tilt('z', 0));
    expect(next).not.toBeNull();
    expect(next?.topElevationEnd).toBeUndefined();
  });
});

describe('computeSlabTiltParams — sloped plane (angle as %)', () => {
  it('X-ring → uphill plan-Y (direction 90), angle = tan(deg)·100', () => {
    const next = computeSlabTiltParams(squareSlab(), tilt('x', 15));
    expect(next?.geometryType).toBe('tilted');
    expect(next?.slope?.direction).toBeCloseTo(90, 6);
    expect(next?.slope?.angle).toBeCloseTo(Math.tan((15 * Math.PI) / 180) * 100, 3);
  });
  it('Z-ring → uphill plan-X (direction 0)', () => {
    const next = computeSlabTiltParams(squareSlab(), tilt('z', 20));
    expect(next?.slope?.direction).toBeCloseTo(0, 6);
  });
  it('returns the slab to box when dragged back to ~0', () => {
    const tilted = { ...squareSlab(), geometryType: 'tilted' as const, slope: { direction: 90, angle: 5 } };
    const next = computeSlabTiltParams(tilted, tilt('x', 0));
    expect(next?.geometryType).toBe('box');
    expect(next?.slope).toBeUndefined();
  });
});
