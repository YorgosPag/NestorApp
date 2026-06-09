/**
 * ADR-429 — Routing Brain: orthogonal A* pathfinder (pure).
 */

import type { Point2D } from '../../../../rendering/types/Types';
import { findOrthogonalPath } from '../astar-grid';
import { segmentHitsObstacles } from '../wall-obstacles';
import type { Rect2D } from '../routing-constants';

const BLOCKER: Rect2D = { minX: 400, minY: -300, maxX: 600, maxY: 300 };

function isAxisAligned(a: Point2D, b: Point2D): boolean {
  return Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6;
}

function pathClearsObstacle(path: readonly Point2D[], obs: Rect2D): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    if (segmentHitsObstacles(path[i], path[i + 1], [obs])) return false;
  }
  return true;
}

describe('findOrthogonalPath', () => {
  it('returns the direct 2-point run when nothing blocks', () => {
    expect(findOrthogonalPath({ x: 0, y: 0 }, { x: 1000, y: 0 }, [])).toEqual([
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
    ]);
  });

  it('detours around a wall blocking the straight run', () => {
    const path = findOrthogonalPath({ x: 0, y: 0 }, { x: 1000, y: 0 }, [BLOCKER]);
    expect(path).not.toBeNull();
    const p = path as Point2D[];
    expect(p.length).toBeGreaterThan(2);
    expect(p[0]).toEqual({ x: 0, y: 0 });
    expect(p[p.length - 1]).toEqual({ x: 1000, y: 0 });
    for (let i = 0; i < p.length - 1; i++) expect(isAxisAligned(p[i], p[i + 1])).toBe(true);
    expect(pathClearsObstacle(p, BLOCKER)).toBe(true);
  });

  it('ignores a wall that hosts an endpoint (no self-detour) → straight', () => {
    const hostWall: Rect2D = { minX: -50, minY: -50, maxX: 50, maxY: 50 };
    expect(findOrthogonalPath({ x: 0, y: 0 }, { x: 1000, y: 0 }, [hostWall])).toEqual([
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
    ]);
  });

  it('returns null when the cell guard trips (→ caller falls back to straight)', () => {
    expect(
      findOrthogonalPath({ x: 0, y: 0 }, { x: 1000, y: 0 }, [BLOCKER], { maxCells: 1 }),
    ).toBeNull();
  });

  it('is deterministic', () => {
    const a = findOrthogonalPath({ x: 0, y: 0 }, { x: 1000, y: 0 }, [BLOCKER]);
    const b = findOrthogonalPath({ x: 0, y: 0 }, { x: 1000, y: 0 }, [BLOCKER]);
    expect(a).toEqual(b);
  });
});
