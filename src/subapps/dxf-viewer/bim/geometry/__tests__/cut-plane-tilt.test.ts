/**
 * ADR-404 Phase 3 — cut-plane-tilt SSoT (Revit 2Δ προβολή στο cut plane).
 *
 * Ελέγχει το `columnCutPlaneShiftMm`/`wallCutPlaneShiftMm`:
 *   - flat (απών/μηδενική κλίση) → no shift (fast-path)
 *   - cutPlane = base → no shift (heightAboveBase 0)
 *   - cutPlane εντός [base, top] → shift = (cutPlane − base)·tan(angle)
 *   - cutPlane > top → clamp στο height (η μετατόπιση της κορυφής)
 *   - cutPlane < base → no shift (clamp στο 0)
 *   - baseOffset λαμβάνεται υπόψη (datum = mm πάνω από τη βάση ορόφου)
 *   - reuse των Phase-1 shear SSoT (ίδια διεύθυνση/πρόσημο)
 */

import { columnCutPlaneShiftMm, wallCutPlaneShiftMm } from '../cut-plane-tilt';
import type { ColumnParams, ColumnTilt } from '../../types/column-types';
import type { WallParams, WallTilt } from '../../types/wall-types';

function makeColumn(tilt?: ColumnTilt, over: Partial<ColumnParams> = {}): ColumnParams {
  return {
    kind: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    anchor: 'center',
    width: 400,
    depth: 400,
    height: 3000,
    rotation: 0,
    tilt,
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
    sceneUnits: 'mm',
    ...over,
  } as ColumnParams;
}

function makeWall(tilt?: WallTilt, over: Partial<WallParams> = {}): WallParams {
  return {
    category: 'interior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 1000, y: 0, z: 0 },
    height: 3000,
    thickness: 200,
    flip: false,
    tilt,
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
    sceneUnits: 'mm',
    ...over,
  } as WallParams;
}

describe('columnCutPlaneShiftMm', () => {
  it('flat → no shift', () => {
    const s = columnCutPlaneShiftMm(makeColumn(), 1200);
    expect(s.dx).toBe(0);
    expect(s.dy).toBe(0);
  });

  it('cutPlane = base (0) → no shift', () => {
    const s = columnCutPlaneShiftMm(makeColumn({ direction: 0, angle: 45 }), 0);
    expect(s.dx).toBeCloseTo(0, 9);
    expect(s.dy).toBeCloseTo(0, 9);
  });

  it('cutPlane 1200, angle 45, dir 0 → +X by 1200', () => {
    const s = columnCutPlaneShiftMm(makeColumn({ direction: 0, angle: 45 }), 1200);
    expect(s.dx).toBeCloseTo(1200, 6);
    expect(s.dy).toBeCloseTo(0, 6);
  });

  it('cutPlane above top → clamp στο height (3000)', () => {
    const s = columnCutPlaneShiftMm(makeColumn({ direction: 0, angle: 45 }), 5000);
    expect(s.dx).toBeCloseTo(3000, 6);
  });

  it('cutPlane below base → no shift (clamp 0)', () => {
    const s = columnCutPlaneShiftMm(makeColumn({ direction: 0, angle: 45 }, { baseOffset: 500 }), 300);
    expect(s.dx).toBeCloseTo(0, 9);
  });

  it('baseOffset 500, cutPlane 1200 → heightAboveBase 700', () => {
    const s = columnCutPlaneShiftMm(makeColumn({ direction: 0, angle: 45 }, { baseOffset: 500 }), 1200);
    expect(s.dx).toBeCloseTo(700, 6);
  });

  it('direction 90 → +Y', () => {
    const s = columnCutPlaneShiftMm(makeColumn({ direction: 90, angle: 30 }), 1000);
    expect(s.dx).toBeCloseTo(0, 6);
    expect(s.dy).toBeCloseTo(1000 * Math.tan((30 * Math.PI) / 180), 6);
  });
});

describe('wallCutPlaneShiftMm', () => {
  it('flat → no shift', () => {
    const s = wallCutPlaneShiftMm(makeWall(), 1200);
    expect(s.dx).toBe(0);
    expect(s.dy).toBe(0);
  });

  it('cutPlane = base → no shift', () => {
    const s = wallCutPlaneShiftMm(makeWall({ angle: 30 }), 0);
    expect(s.dx).toBeCloseTo(0, 9);
    expect(s.dy).toBeCloseTo(0, 9);
  });

  it('lean ⟂ run (start→end +X) → shift κατά +Y, magnitude (cutPlane)·tan(angle)', () => {
    const s = wallCutPlaneShiftMm(makeWall({ angle: 45 }), 1200);
    // αριστερή κάθετη της φοράς +X = +Y
    expect(s.dx).toBeCloseTo(0, 6);
    expect(s.dy).toBeCloseTo(1200, 6);
  });

  it('cutPlane above top → clamp στο height', () => {
    const s = wallCutPlaneShiftMm(makeWall({ angle: 45 }), 9000);
    expect(Math.hypot(s.dx, s.dy)).toBeCloseTo(3000, 6);
  });

  it('signed angle → αντίθετη πλευρά', () => {
    const a = wallCutPlaneShiftMm(makeWall({ angle: 20 }), 1200);
    const b = wallCutPlaneShiftMm(makeWall({ angle: -20 }), 1200);
    expect(b.dx).toBeCloseTo(-a.dx, 9);
    expect(b.dy).toBeCloseTo(-a.dy, 9);
  });
});
