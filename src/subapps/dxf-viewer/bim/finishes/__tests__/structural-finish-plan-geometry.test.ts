/**
 * ADR-505 (finish export) — `collectFinishOutlinePlanPolylines` SSoT.
 *
 * Επαληθεύει: faces → world λωρίδες (4 σημεία/όψη), χρώμα flat υλικού, ύψος για
 * extrusion· κενές faces → []· degenerate segment (μηδέν μήκος) → παραλείπεται.
 */

import { collectFinishOutlinePlanPolylines } from '../structural-finish-plan-geometry';
import type { StructuralFinishFaces, FinishFaceSegment } from '../structural-finish-types';

function seg(a: { x: number; y: number }, b: { x: number; y: number }): FinishFaceSegment {
  return {
    a, b,
    classification: 'interior',
    materialId: 'mat-plaster-int',
    thickness: 15,
    lengthM: Math.hypot(b.x - a.x, b.y - a.y) * 0.001,
    aJunction: false,
    bJunction: false,
    aSquareEnd: false,
    bSquareEnd: false,
  };
}

function faces(segments: FinishFaceSegment[]): StructuralFinishFaces {
  return { segments, heightM: 3, interiorAreaM2: 0, exteriorAreaM2: 0 };
}

describe('collectFinishOutlinePlanPolylines (ADR-505)', () => {
  it('μία όψη → μία λωρίδα 4 σημείων με χρώμα + ύψος', () => {
    const out = collectFinishOutlinePlanPolylines(faces([seg({ x: 0, y: 0 }, { x: 100, y: 0 })]), 'mm', 3000);
    expect(out).toHaveLength(1);
    expect(out[0].points).toHaveLength(4);
    expect(out[0].heightMm).toBe(3000);
    expect(out[0].colorHex).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('ADR-449 PART B — colorOverride υπερισχύει του χρώματος υλικού (Revit «Paint»)', () => {
    const painted: FinishFaceSegment = { ...seg({ x: 0, y: 0 }, { x: 100, y: 0 }), colorOverride: '#c0d8b0' };
    const out = collectFinishOutlinePlanPolylines(faces([painted]), 'mm', 0);
    expect(out[0].colorHex).toBe('#c0d8b0');
  });

  it('χωρίς colorOverride → flat χρώμα υλικού (SSoT με 3Δ)', () => {
    const out = collectFinishOutlinePlanPolylines(faces([seg({ x: 0, y: 0 }, { x: 100, y: 0 })]), 'mm', 0);
    // mat-plaster-int → mat-plaster def color 0xe8e0d0.
    expect(out[0].colorHex).toBe('#e8e0d0');
  });

  it('undefined / κενές faces → []', () => {
    expect(collectFinishOutlinePlanPolylines(undefined, 'mm', 3000)).toEqual([]);
    expect(collectFinishOutlinePlanPolylines(faces([]), 'mm', 3000)).toEqual([]);
  });

  it('degenerate segment (μηδενικό μήκος) → παραλείπεται (null offset)', () => {
    const out = collectFinishOutlinePlanPolylines(faces([seg({ x: 5, y: 5 }, { x: 5, y: 5 })]), 'mm', 3000);
    expect(out).toEqual([]);
  });

  it('η outer πλευρά μετατοπίζεται προς τα έξω κατά το πάχος (CCW (dy,−dx))', () => {
    // οριζόντια όψη a→b κατά +X → outward normal = (0,−1) → outer points έχουν y<0.
    const out = collectFinishOutlinePlanPolylines(faces([seg({ x: 0, y: 0 }, { x: 100, y: 0 })]), 'mm', 0);
    const [aCore, aOuter, bOuter] = out[0].points;
    expect(aCore.y).toBeCloseTo(0);
    expect(aOuter.y).toBeLessThan(0);
    expect(bOuter.y).toBeLessThan(0);
  });
});
