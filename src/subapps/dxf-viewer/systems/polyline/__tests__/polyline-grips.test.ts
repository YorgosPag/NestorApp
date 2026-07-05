/**
 * ADR-561 — `getPolylineMoveRotateGrips` SSoT tests (rect-box parity vs bbox).
 */
import {
  getPolylineMoveRotateGrips,
  polylineMoveRotateStartIndex,
  getPolylineGripAlignmentAnchors,
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

  it('GENERIC polyline → both handles on the LONGEST segment axis at its ¼ points (triangle)', () => {
    // Longest edge = v0→v1 (length 40, horizontal); the other two are ~28.3.
    const verts = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 20, y: 20 }];
    const [move, rot] = getPolylineMoveRotateGrips('P1', verts, true, 6);
    // Handles sit ON that edge (y = 0), NOT at the empty bbox centre (20,10).
    expect(move.position.x).toBeCloseTo(10, 6); // ¼-west of the segment
    expect(move.position.y).toBeCloseTo(0, 6);
    expect(rot.position.x).toBeCloseTo(30, 6); // ¼-east of the segment
    expect(rot.position.y).toBeCloseTo(0, 6);
  });

  it('open corner (2 lines joined at an angle) → handles on the longer leg, off the empty bbox centre', () => {
    // Giorgio 2026-07-05 repro: vertical leg A→P (len 100) is longer than P→B (len 60).
    const A = { x: 0, y: 100 }, P = { x: 0, y: 0 }, B = { x: 60, y: 0 };
    const [move, rot] = getPolylineMoveRotateGrips('L1', [A, P, B], false, 5);
    // Both land ON the vertical leg (x = 0), never in the empty bbox centre (30,50).
    expect(move.position.x).toBeCloseTo(0, 6);
    expect(rot.position.x).toBeCloseTo(0, 6);
    // rotation near the free end A (¼ point, y≈75), move near the corner P (¾ point, y≈25).
    expect(rot.position.y).toBeCloseTo(75, 6);
    expect(move.position.y).toBeCloseTo(25, 6);
  });

  it('degenerate ring (<2 vertices) → no handles', () => {
    expect(getPolylineMoveRotateGrips('P1', [{ x: 0, y: 0 }], true, 1)).toHaveLength(0);
  });
});

describe('getPolylineGripAlignmentAnchors (ADR-561 — vertex reshape tracking anchors)', () => {
  const A = { x: 0, y: 0 }, B = { x: 40, y: 0 }, C = { x: 40, y: 30 };

  it('open ring endpoint (grip 0) → the single adjacent vertex', () => {
    expect(getPolylineGripAlignmentAnchors(0, [A, B, C], false)).toEqual([B]);
  });

  it('open ring other endpoint (grip n−1) → the single adjacent vertex', () => {
    expect(getPolylineGripAlignmentAnchors(2, [A, B, C], false)).toEqual([B]);
  });

  it('interior/corner vertex → BOTH adjacent vertices', () => {
    expect(getPolylineGripAlignmentAnchors(1, [A, B, C], false)).toEqual([A, C]);
  });

  it('closed ring → neighbours wrap (vertex 0 ↔ vertex n−1)', () => {
    const D = { x: 0, y: 30 };
    expect(getPolylineGripAlignmentAnchors(0, [A, B, C, D], true)).toEqual([D, B]);
  });

  it('non-vertex grip index (edge / move / rotation handle) → null', () => {
    expect(getPolylineGripAlignmentAnchors(3, [A, B, C], false)).toBeNull();
  });

  it('degenerate ring (<2 vertices) → null', () => {
    expect(getPolylineGripAlignmentAnchors(0, [A], false)).toBeNull();
  });
});
