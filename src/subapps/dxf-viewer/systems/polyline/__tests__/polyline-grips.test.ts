/**
 * ADR-561 — `getPolylineMoveRotateGrips` SSoT tests (rect-box parity vs bbox).
 */
import {
  getPolylineMoveRotateGrips,
  polylineMoveRotateStartIndex,
  POLYLINE_MOVE_KIND,
  POLYLINE_ROTATION_KIND,
} from '../polyline-grips';

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
