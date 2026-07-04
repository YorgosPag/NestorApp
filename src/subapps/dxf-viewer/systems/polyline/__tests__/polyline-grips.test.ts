/**
 * ADR-561 — `getPolylineMoveRotateGrips` SSoT tests (rect-box parity vs bbox).
 */
import {
  getPolylineMoveRotateGrips,
  polylineMoveRotateStartIndex,
  applyPolylineRotationDrag,
  POLYLINE_MOVE_KIND,
  POLYLINE_ROTATION_KIND,
} from '../polyline-grips';
import { rotateEntity } from '../../../utils/rotation-math';
import type { Entity } from '../../../types/entities';

describe('polylineMoveRotateStartIndex', () => {
  it('closed ring: vertices + N edges', () => {
    expect(polylineMoveRotateStartIndex(4, true)).toBe(8); // 4 vertices + 4 edges
  });
  it('open ring: vertices + (N-1) edges', () => {
    expect(polylineMoveRotateStartIndex(5, false)).toBe(9); // 5 vertices + 4 edges
  });
});

describe('getPolylineMoveRotateGrips (ADR-561)', () => {
  it('emits a MOVE + a ROTATION grip with the shared kinds + given indices', () => {
    const verts = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }];
    const grips = getPolylineMoveRotateGrips('P1', verts, true, 8);
    expect(grips).toHaveLength(2);
    expect(grips[0]).toMatchObject({ gripIndex: 8, type: 'center', movesEntity: true, polylineGripKind: POLYLINE_MOVE_KIND });
    expect(grips[1]).toMatchObject({ gripIndex: 9, type: 'vertex', movesEntity: false, polylineGripKind: POLYLINE_ROTATION_KIND });
  });

  it('RECTANGLE → rect-box parity: move at box centre, rotation midway below on the box axis', () => {
    // 40×20 axis-aligned rectangle.
    const verts = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }];
    const [move, rot] = getPolylineMoveRotateGrips('P1', verts, true, 8);
    expect(move.position).toEqual({ x: 20, y: 10 });
    // halfLength = 10 ⇒ rotationHandleMidwayOffset(20) = −5 ⇒ midway below centre.
    expect(rot.position.x).toBeCloseTo(20, 6);
    expect(rot.position.y).toBeCloseTo(5, 6);
  });

  it('GENERIC polyline → bbox placement (non-rectangular triangle)', () => {
    const verts = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 20, y: 20 }];
    const [move, rot] = getPolylineMoveRotateGrips('P1', verts, true, 6);
    expect(move.position).toEqual({ x: 20, y: 10 }); // bbox centre
    // bbox height 20 ⇒ offset −5 below centre.
    expect(rot.position).toEqual({ x: 20, y: 5 });
  });

  it('degenerate ring (<2 vertices) → no handles', () => {
    expect(getPolylineMoveRotateGrips('P1', [{ x: 0, y: 0 }], true, 1)).toHaveLength(0);
  });
});

describe('applyPolylineRotationDrag (ADR-561 — live rotation ghost)', () => {
  it('rotates every vertex +90° CCW about an EXTERNAL pivot', () => {
    // anchor @ 0° (east), cursor @ 90° (north) → swept = +90° CCW about origin.
    const verts = [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 10 }];
    const rotated = applyPolylineRotationDrag({
      vertices: verts, anchor: { x: 1, y: 0 }, currentPos: { x: 0, y: 1 }, pivot: { x: 0, y: 0 },
    });
    expect(rotated).not.toBeNull();
    // (10,0) → (0,10); (20,0) → (0,20); (20,10) → (−10,20); (10,10) → (−10,10).
    expect(rotated![0].x).toBeCloseTo(0, 6);
    expect(rotated![0].y).toBeCloseTo(10, 6);
    expect(rotated![2].x).toBeCloseTo(-10, 6);
    expect(rotated![2].y).toBeCloseTo(20, 6);
  });

  it('defaults the pivot to the vertices bbox centre (commit fallback parity)', () => {
    // 40×20 rectangle, bbox centre (20,10). anchor @ centre+east, cursor @ centre+north → +90°.
    const verts = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }];
    const rotated = applyPolylineRotationDrag({
      vertices: verts, anchor: { x: 30, y: 10 }, currentPos: { x: 20, y: 20 },
    });
    expect(rotated).not.toBeNull();
    // (0,0) rotated +90° about (20,10) → (30, −10).
    expect(rotated![0].x).toBeCloseTo(30, 6);
    expect(rotated![0].y).toBeCloseTo(-10, 6);
  });

  it('returns null for a degenerate / zero sweep (cursor on the pivot)', () => {
    expect(applyPolylineRotationDrag({
      vertices: [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }],
      anchor: { x: 10, y: 0 }, currentPos: { x: 0, y: 0 }, pivot: { x: 0, y: 0 },
    })).toBeNull();
  });

  it('returns null for <2 vertices', () => {
    expect(applyPolylineRotationDrag({
      vertices: [{ x: 5, y: 5 }], anchor: { x: 1, y: 0 }, currentPos: { x: 0, y: 1 }, pivot: { x: 0, y: 0 },
    })).toBeNull();
  });

  it('is byte-identical to the commit SSoT (rotateEntity polyline case) for the same sweep', () => {
    const verts = [{ x: 3, y: 7 }, { x: 25, y: 7 }, { x: 25, y: 18 }, { x: 3, y: 18 }];
    const pivot = { x: 0, y: 0 };
    const anchor = { x: 10, y: 0 };    // 0°
    const currentPos = { x: 0, y: 10 }; // 90° → swept = +90°
    const viaPreview = applyPolylineRotationDrag({ vertices: verts, anchor, currentPos, pivot });
    const viaCommit = rotateEntity(
      { type: 'polyline', vertices: verts, closed: true } as unknown as Entity, pivot, 90,
    ) as { vertices: { x: number; y: number }[] };
    expect(viaPreview).not.toBeNull();
    viaPreview!.forEach((p, i) => {
      expect(p.x).toBeCloseTo(viaCommit.vertices[i].x, 6);
      expect(p.y).toBeCloseTo(viaCommit.vertices[i].y, 6);
    });
  });
});
