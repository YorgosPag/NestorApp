/**
 * ADR-561 — shared primitive ROTATION drag SSoT tests (`primitive-rotation-drag.ts`).
 *
 * The live ghost + the commit share this kernel: the guarded anchor-relative swept angle
 * (`resolveSweptRotationDeg`) + the geometry via the ONE `rotateEntity` engine
 * (`applyPrimitiveRotationDrag`). These tests pin the swept-angle guard and prove the
 * ghost patch is IDENTICAL to `rotateEntity(entity, pivot, sweptDeg)` for arc + polyline.
 */
import { resolveSweptRotationDeg, applyPrimitiveRotationDrag } from '../primitive-rotation-drag';
import { rotateEntity } from '../../../utils/rotation-math';
import type { Entity } from '../../../types/entities';

describe('resolveSweptRotationDeg (guarded anchor-relative sweep)', () => {
  it('+90° CCW: anchor east, cursor north about the origin', () => {
    expect(resolveSweptRotationDeg({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(90, 6);
  });
  it('null on a zero sweep (cursor on the pivot)', () => {
    expect(resolveSweptRotationDeg({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 })).toBeNull();
  });
  it('null when the anchor sits on the pivot (degenerate reference arm)', () => {
    expect(resolveSweptRotationDeg({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 })).toBeNull();
  });
});

describe('applyPrimitiveRotationDrag (delegates geometry to the ONE rotateEntity)', () => {
  it('ARC: patch === rotateEntity(arc) for the same swept angle', () => {
    const arc = { type: 'arc', center: { x: 5, y: 5 }, radius: 10, startAngle: 30, endAngle: 120 };
    const pivot = { x: 0, y: 0 };
    const patch = applyPrimitiveRotationDrag(arc as unknown as Entity, {
      anchor: { x: 10, y: 0 }, currentPos: { x: 0, y: 10 }, pivot, // 0° → 90° = +90°
    }) as { center: { x: number; y: number }; startAngle: number; endAngle: number };
    const expected = rotateEntity(arc as unknown as Entity, pivot, 90) as typeof patch;
    expect(patch.center.x).toBeCloseTo(expected.center.x, 6);
    expect(patch.center.y).toBeCloseTo(expected.center.y, 6);
    expect(patch.startAngle).toBeCloseTo(expected.startAngle, 6);
    expect(patch.endAngle).toBeCloseTo(expected.endAngle, 6);
  });

  it('POLYLINE: every vertex === rotateEntity(polyline) for the same swept angle', () => {
    const verts = [{ x: 3, y: 7 }, { x: 25, y: 7 }, { x: 25, y: 18 }, { x: 3, y: 18 }];
    const poly = { type: 'polyline', vertices: verts, closed: true };
    const pivot = { x: 0, y: 0 };
    const patch = applyPrimitiveRotationDrag(poly as unknown as Entity, {
      anchor: { x: 10, y: 0 }, currentPos: { x: 0, y: 10 }, pivot, // +90°
    }) as { vertices: { x: number; y: number }[] };
    const expected = rotateEntity(poly as unknown as Entity, pivot, 90) as typeof patch;
    patch.vertices.forEach((p, i) => {
      expect(p.x).toBeCloseTo(expected.vertices[i].x, 6);
      expect(p.y).toBeCloseTo(expected.vertices[i].y, 6);
    });
  });

  it('returns null on a degenerate / zero sweep (no ghost)', () => {
    const poly = { type: 'polyline', vertices: [{ x: 1, y: 0 }, { x: 2, y: 0 }], closed: false };
    expect(applyPrimitiveRotationDrag(poly as unknown as Entity, {
      anchor: { x: 10, y: 0 }, currentPos: { x: 0, y: 0 }, pivot: { x: 0, y: 0 },
    })).toBeNull();
  });
});
