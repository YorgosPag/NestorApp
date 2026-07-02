/**
 * ADR-398 — Column Body Corner Projection Snap tests.
 *
 * Verifies the pure projection core that backs the move / resize / draw corner
 * snap. A column at (0,0) with the 400×400 default has corners at (±200, ±200).
 *
 *   - move:   translating the body shifts the matched corner onto the target.
 *   - resize: width/depth drag projects corners; correction returned.
 *   - draw:   the would-be column's corner snaps onto a target.
 *   - best-corner-wins: the closest of the 4 candidates is chosen.
 *   - rotation excluded; no-match → null; self-match filtered out.
 */

import {
  findColumnGripCornerSnap,
  findColumnDrawCornerSnap,
  isColumnCornerSnapGrip,
  type FindSnapPoint,
} from '../column-corner-snap';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import { computeColumnGeometry } from '../../geometry/column-geometry';
import type { ColumnEntity, ColumnParams } from '../../types/column-types';
import type { ProSnapResult } from '../../../snapping/extended-types';
import type { Point2D } from '../../../rendering/types/Types';

function makeColumn(params: ColumnParams, id = 'col_1'): ColumnEntity {
  return {
    id, type: 'column', kind: params.kind, layerId: '0',
    params, geometry: undefined as never, validation: undefined as never, visible: true,
  } as unknown as ColumnEntity;
}

const rect = (x: number, y: number, o: Partial<ColumnParams> = {}, id = 'col_1') =>
  makeColumn({ ...buildDefaultColumnParams({ x, y }, 'rectangular'), ...o }, id);

interface Target { near: Point2D; snap: Point2D; dist: number; entityId?: string }

/** Snap-engine stub: returns the first target whose `near` is within `tol`. */
function snapStub(targets: Target[], tol = 60): FindSnapPoint {
  return (x, y) => {
    for (const t of targets) {
      if (Math.hypot(x - t.near.x, y - t.near.y) <= tol) {
        return {
          found: true,
          snappedPoint: { ...t.snap },
          snapPoint: { point: t.snap, type: 'endpoint', description: 'endpoint', distance: t.dist, priority: 0, entityId: t.entityId } as never,
          allCandidates: [],
          originalPoint: { x, y },
          activeMode: 'endpoint' as never,
          timestamp: 0,
          distance: t.dist,
          entityId: t.entityId,
        } as ProSnapResult;
      }
    }
    return null;
  };
}

describe('isColumnCornerSnapGrip', () => {
  it('true for move + resize grips, false for rotation/unknown', () => {
    expect(isColumnCornerSnapGrip('column-center')).toBe(true);
    expect(isColumnCornerSnapGrip('column-width')).toBe(true);
    expect(isColumnCornerSnapGrip('column-depth')).toBe(true);
    expect(isColumnCornerSnapGrip('column-rotation')).toBe(false);
    expect(isColumnCornerSnapGrip('wall-start')).toBe(false);
    expect(isColumnCornerSnapGrip(null)).toBe(false);
  });
});

describe('findColumnGripCornerSnap — move', () => {
  it('shifts the cursor so the matched corner lands on the target', () => {
    const col = rect(0, 0);
    // Move base at (0,0), cursor at (1000,1000) ⇒ proposed center (1000,1000),
    // NE corner at (1200,1200). Target sits 10 units off that corner.
    const find = snapStub([{ near: { x: 1200, y: 1200 }, snap: { x: 1210, y: 1210 }, dist: 14 }]);
    const r = findColumnGripCornerSnap(col, 'column-center', { x: 0, y: 0 }, { x: 1000, y: 1000 }, find);
    expect(r).not.toBeNull();
    expect(r!.adjustedCursorPos.x).toBeCloseTo(1010, 6);
    expect(r!.adjustedCursorPos.y).toBeCloseTo(1010, 6);
    expect(r!.snapResult.snappedPoint).toEqual({ x: 1210, y: 1210 });
  });

  it('returns null when no corner is near a target', () => {
    const col = rect(0, 0);
    const find = snapStub([{ near: { x: 5000, y: 5000 }, snap: { x: 5000, y: 5000 }, dist: 1 }]);
    expect(findColumnGripCornerSnap(col, 'column-center', { x: 0, y: 0 }, { x: 100, y: 100 }, find)).toBeNull();
  });

  it('returns null for the rotation grip (corner snap excluded)', () => {
    const col = rect(0, 0);
    const find = snapStub([{ near: { x: 200, y: 200 }, snap: { x: 210, y: 210 }, dist: 14 }]);
    expect(findColumnGripCornerSnap(col, 'column-rotation', { x: 0, y: 0 }, { x: 0, y: 0 }, find)).toBeNull();
  });

  it('ignores a self-match (own stale corner in the index)', () => {
    const col = rect(0, 0, {}, 'col_self');
    // Corner of the un-moved column at (200,200) returned but tagged as self.
    const find = snapStub([{ near: { x: 200, y: 200 }, snap: { x: 200, y: 200 }, dist: 0, entityId: 'col_self' }]);
    expect(findColumnGripCornerSnap(col, 'column-center', { x: 0, y: 0 }, { x: 0, y: 0 }, find)).toBeNull();
  });

  it('picks the closest of two candidate corners', () => {
    const col = rect(0, 0);
    // cursor (0,0): corners at (±200,±200). Two targets, NE closer (dist 5) than SW (dist 30).
    const find = snapStub([
      { near: { x: 200, y: 200 }, snap: { x: 205, y: 205 }, dist: 5 },
      { near: { x: -200, y: -200 }, snap: { x: -230, y: -230 }, dist: 30 },
    ]);
    const r = findColumnGripCornerSnap(col, 'column-center', { x: 0, y: 0 }, { x: 0, y: 0 }, find);
    expect(r).not.toBeNull();
    expect(r!.adjustedCursorPos.x).toBeCloseTo(5, 6);
    expect(r!.adjustedCursorPos.y).toBeCloseTo(5, 6);
  });
});

describe('findColumnGripCornerSnap — Alt whole-entity move (ADR-363 Φ1G.5)', () => {
  it('projects via translate for the rotation grip when altMove=true (else null)', () => {
    const col = rect(0, 0);
    // Base at (0,0), cursor (1000,1000) ⇒ translate delta (1000,1000) ⇒ NE corner
    // moves (200,200)→(1200,1200). Target sits 14 units off that translated corner.
    const find = snapStub([{ near: { x: 1200, y: 1200 }, snap: { x: 1210, y: 1210 }, dist: 14 }]);
    // Rotation grip is excluded from the parametric projection → null without altMove.
    expect(
      findColumnGripCornerSnap(col, 'column-rotation', { x: 0, y: 0 }, { x: 1000, y: 1000 }, find),
    ).toBeNull();
    // With altMove the grabbed (rotation) grip is only a base point → whole-body translate.
    const r = findColumnGripCornerSnap(col, 'column-rotation', { x: 0, y: 0 }, { x: 1000, y: 1000 }, find, true);
    expect(r).not.toBeNull();
    expect(r!.adjustedCursorPos.x).toBeCloseTo(1010, 6);
    expect(r!.adjustedCursorPos.y).toBeCloseTo(1010, 6);
    expect(r!.snapResult.snappedPoint).toEqual({ x: 1210, y: 1210 });
  });

  it('translates (not resizes) when altMove=true on a width grip', () => {
    const col = rect(0, 0);
    // Width handle base at (200,0); cursor (1200,1000) ⇒ delta (1000,1000). altMove ⇒
    // the whole column translates so the NE corner lands at (1200,1200) — NOT a width
    // resize. Target on that translated corner.
    const find = snapStub([{ near: { x: 1200, y: 1200 }, snap: { x: 1200, y: 1200 }, dist: 0 }]);
    const r = findColumnGripCornerSnap(col, 'column-width', { x: 200, y: 0 }, { x: 1200, y: 1000 }, find, true);
    expect(r).not.toBeNull();
    // Corner already on target ⇒ zero correction (pure translate landed it exactly).
    expect(r!.adjustedCursorPos.x).toBeCloseTo(1200, 6);
    expect(r!.adjustedCursorPos.y).toBeCloseTo(1000, 6);
  });
});

describe('findColumnGripCornerSnap — L-shape real footprint vertices (ADR-363 Φ1G.5)', () => {
  it('snaps a REAL reentrant vertex no bounding-box corner reaches', () => {
    // Regression for the L-shape ALT-move bug: the projection used the 4 bbox
    // corners, so the concave (reentrant) vertex — which sits STRICTLY inside the
    // bbox on both axes — could never magnet onto a neighbour. It now projects the
    // ACTUAL footprint vertices (`computeColumnGeometry(...).footprint.vertices`).
    const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'L-shape');
    const col = makeColumn(params, 'col_L');
    const verts = computeColumnGeometry(params).footprint.vertices;
    const xs = verts.map((v) => v.x), ys = verts.map((v) => v.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    // The reentrant corner is the only vertex interior on BOTH axes → not a bbox corner.
    const inner = verts.find((v) => v.x > minX && v.x < maxX && v.y > minY && v.y < maxY);
    expect(inner).toBeDefined();
    // Base === cursor ⇒ zero translate; the footprint stays put. Target 8/-5 off the
    // real vertex; Alt whole-body move via a NON-projection grip (rotation).
    const find = snapStub([{ near: { x: inner!.x, y: inner!.y }, snap: { x: inner!.x + 8, y: inner!.y - 5 }, dist: 9 }]);
    const r = findColumnGripCornerSnap(col, 'column-rotation', { x: 0, y: 0 }, { x: 0, y: 0 }, find, true);
    expect(r).not.toBeNull();
    // Correction = target − vertex ⇒ the reentrant corner lands exactly on the snap.
    expect(r!.adjustedCursorPos.x).toBeCloseTo(8, 6);
    expect(r!.adjustedCursorPos.y).toBeCloseTo(-5, 6);
    expect(r!.snapResult.snappedPoint).toEqual({ x: inner!.x + 8, y: inner!.y - 5 });
  });
});

describe('findColumnGripCornerSnap — resize', () => {
  it('returns a correction when a moving corner snaps during width drag', () => {
    const col = rect(0, 0); // width handle for center anchor at (200,0)
    // Drag the width handle outward; the far corner approaches a target.
    const find = snapStub([{ near: { x: 300, y: 200 }, snap: { x: 310, y: 200 }, dist: 10 }], 120);
    const r = findColumnGripCornerSnap(col, 'column-width', { x: 200, y: 0 }, { x: 300, y: 0 }, find);
    expect(r).not.toBeNull();
    // Correction = target − corner along the matched corner.
    expect(r!.snapResult.snappedPoint).toEqual({ x: 310, y: 200 });
  });
});

describe('findColumnDrawCornerSnap', () => {
  it('snaps a corner of the would-be column onto a target', () => {
    // Placing a default rect at (1000,1000): NE corner at (1200,1200).
    const find = snapStub([{ near: { x: 1200, y: 1200 }, snap: { x: 1190, y: 1195 }, dist: 11 }]);
    const r = findColumnDrawCornerSnap({ x: 1000, y: 1000 }, { kind: 'rectangular', anchor: 'center' }, 'mm', find);
    expect(r).not.toBeNull();
    expect(r!.adjustedCursorPos.x).toBeCloseTo(990, 6);
    expect(r!.adjustedCursorPos.y).toBeCloseTo(995, 6);
  });

  it('returns null when no corner is near a target', () => {
    const find = snapStub([{ near: { x: 9000, y: 9000 }, snap: { x: 9000, y: 9000 }, dist: 1 }]);
    expect(findColumnDrawCornerSnap({ x: 0, y: 0 }, { kind: 'rectangular', anchor: 'center' }, 'mm', find)).toBeNull();
  });

  // ADR-398 — regression for the meter-scene unit-mismatch bug (ADR-397 #2 class):
  // 400mm column in a 'm' scene ⇒ corners at position ± 0.2 scene units (NOT ±200).
  it('scales corners by sceneUnits — meter scene corner near position, not 1000× off', () => {
    // Place at (1,1) scene-m; NE corner at (1.2, 1.2). Pre-fix it was at (201, 201).
    const find = snapStub([{ near: { x: 1.2, y: 1.2 }, snap: { x: 1.25, y: 1.25 }, dist: 0.07 }], 0.3);
    const r = findColumnDrawCornerSnap({ x: 1, y: 1 }, { kind: 'rectangular', anchor: 'center' }, 'm', find);
    expect(r).not.toBeNull();
    expect(r!.adjustedCursorPos.x).toBeCloseTo(1.05, 6);
    expect(r!.adjustedCursorPos.y).toBeCloseTo(1.05, 6);
  });
});
