/**
 * ADR-398 — shared corner-projection core tests. Backs both wall face-corner
 * (ADR-371) and column body-corner (ADR-398) snapping.
 */

import { findBestCornerProjection, type FindSnapPoint } from '../corner-projection-snap';
import type { ProSnapResult } from '../../../snapping/extended-types';
import type { Point2D } from '../../../rendering/types/Types';

interface Target { near: Point2D; snap: Point2D; dist: number; entityId?: string }

function snapStub(targets: Target[], tol = 60): FindSnapPoint {
  return (x, y) => {
    for (const t of targets) {
      if (Math.hypot(x - t.near.x, y - t.near.y) <= tol) {
        return {
          found: true,
          snappedPoint: { ...t.snap },
          snapPoint: { point: t.snap, type: 'endpoint', description: 'endpoint', distance: t.dist, priority: 0, entityId: t.entityId } as never,
          allCandidates: [], originalPoint: { x, y }, activeMode: 'endpoint' as never,
          timestamp: 0, distance: t.dist, entityId: t.entityId,
        } as ProSnapResult;
      }
    }
    return null;
  };
}

describe('findBestCornerProjection', () => {
  const corners: Point2D[] = [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
  ];

  it('returns null when no corner is near a target', () => {
    expect(findBestCornerProjection(corners, { x: 50, y: 50 }, snapStub([{ near: { x: 999, y: 999 }, snap: { x: 999, y: 999 }, dist: 1 }]))).toBeNull();
  });

  it('shifts cursor so the matched corner lands exactly on the target', () => {
    // Corner (100,100) snaps to (110,108). cursor (50,50) ⇒ +(10,8).
    const r = findBestCornerProjection(corners, { x: 50, y: 50 }, snapStub([{ near: { x: 100, y: 100 }, snap: { x: 110, y: 108 }, dist: 12 }]));
    expect(r).not.toBeNull();
    expect(r!.adjustedCursorPos).toEqual({ x: 60, y: 58 });
    expect(r!.snapResult.snappedPoint).toEqual({ x: 110, y: 108 });
  });

  it('picks the closest of multiple matches', () => {
    const r = findBestCornerProjection(corners, { x: 0, y: 0 }, snapStub([
      { near: { x: 0, y: 0 }, snap: { x: 3, y: 0 }, dist: 30 },
      { near: { x: 100, y: 0 }, snap: { x: 102, y: 0 }, dist: 2 },
    ]));
    expect(r!.snapResult.distance).toBe(2);
    expect(r!.adjustedCursorPos).toEqual({ x: 2, y: 0 }); // via corner (100,0) → +2 x
  });

  it('skips matches on the excluded (self) entity', () => {
    const r = findBestCornerProjection(corners, { x: 0, y: 0 }, snapStub([
      { near: { x: 0, y: 0 }, snap: { x: 0, y: 0 }, dist: 0, entityId: 'self' },
    ]), 'self');
    expect(r).toBeNull();
  });
});
