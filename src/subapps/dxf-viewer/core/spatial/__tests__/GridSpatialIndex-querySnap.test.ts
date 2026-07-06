/**
 * GridSpatialIndex.querySnap — snap-aperture regression (2026-07-07).
 *
 * The snap aperture is a SCREEN-space pickbox already converted to world units by
 * the caller (`worldRadiusForType`) — AutoCAD/Revit/Figma model, constant on screen
 * at every zoom. `querySnap` MUST honour that radius directly. A former
 * `Math.min(tolerance, cellSize / 2)` clamp shrank the reach below the aperture,
 * silently killing snapping when zoomed out on large geometry (e.g. a 155 m
 * dimension whose far def points appeared/vanished with zoom). These tests lock the
 * fix: a target within `tolerance` is returned even when `tolerance > cellSize / 2`.
 */

import { GridSpatialIndex } from '../GridSpatialIndex';
import type { SpatialItem, SpatialBounds } from '../ISpatialIndex';

const BOUNDS: SpatialBounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
const CELL = 50; // → old clamp ceiling was cellSize/2 = 25

/** A degenerate-bounds point item (how snap points are indexed). */
function pointItem(id: string, x: number, y: number): SpatialItem {
  return { id, bounds: { minX: x, minY: y, maxX: x, maxY: y }, data: { id } } as SpatialItem;
}

function makeIndex(): GridSpatialIndex {
  const idx = new GridSpatialIndex(BOUNDS, CELL);
  idx.insert(pointItem('near', 100, 0));   // 40 units from the query point
  idx.insert(pointItem('far', 200, 0));    // 140 units from the query point
  return idx;
}

describe('GridSpatialIndex.querySnap — aperture honoured beyond cellSize/2', () => {
  it('returns a target whose distance exceeds cellSize/2 but is within tolerance', () => {
    const idx = makeIndex();
    // Query at (60,0): dist→near = 40. 40 > 25 (old clamp would drop it) but 40 ≤ 50.
    const results = idx.querySnap({ x: 60, y: 0 }, 50, 'dim_def_point');
    expect(results.some((r) => r.item.id === 'near')).toBe(true);
  });

  it('still excludes a target beyond the tolerance', () => {
    const idx = makeIndex();
    // dist→far = 140 > 50 → out of aperture, must not be returned.
    const results = idx.querySnap({ x: 60, y: 0 }, 50, 'dim_def_point');
    expect(results.some((r) => r.item.id === 'far')).toBe(false);
  });

  it('a tiny (zoomed-in) aperture still snaps only the very near point', () => {
    const idx = makeIndex();
    // tolerance 5 < cellSize/2: dist→near = 40 > 5 → nothing in reach.
    expect(idx.querySnap({ x: 60, y: 0 }, 5, 'endpoint')).toHaveLength(0);
    // right on top of it → within a 5-unit aperture.
    expect(idx.querySnap({ x: 100, y: 0 }, 5, 'endpoint').some((r) => r.item.id === 'near')).toBe(true);
  });
});
