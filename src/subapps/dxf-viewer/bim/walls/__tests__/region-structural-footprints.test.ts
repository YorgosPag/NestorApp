/**
 * ADR-638 §wall-aware — region detection from BIM structural footprints.
 *
 * Giorgio (2026-07-11): το εργαλείο διαρρύθμισης μπάνιου (και ο θερμικός χώρος /
 * αναγνώριση χώρων) ΔΕΝ αναγνώριζε δωμάτια οριοθετημένα από BIM ΤΟΙΧΟΥΣ — μόνο από
 * DXF γραμμές. Ρίζα: το `extractLineSegments` αγνοούσε τους τοίχους. Fix: opt-in
 * `structuralFootprints` που εκθέτει τις παρειές του footprint τοίχων/κολόνων ως
 * τμήματα (Revit «room bounding»). Default OFF → πλήρης μη-regression για wall-fill.
 *
 * Αυτά τα tests αποδεικνύουν: (1) χωρίς το flag ένα δωμάτιο ΜΟΝΟ από τοίχους δεν
 * ανιχνεύεται· (2) με το flag ανιχνεύεται· (3) το `detectSpaces` (αναγνώριση) το πιάνει.
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity } from '../../../types/entities';
import type { WallEntity } from '../../types/wall-types';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import { extractLineSegments } from '../wall-in-region';
import { getCachedRegionPerimeters } from '../perimeter-from-faces';
import { detectSpaces } from '../../../systems/recognition/space-detection';

/** Ένας ευθύς τοίχος start→end (canonical mm) μέσω του SSoT builder. */
function wall(sx: number, sy: number, ex: number, ey: number): WallEntity {
  const params = buildDefaultWallParams({ x: sx, y: sy }, { x: ex, y: ey }, {}, 'mm');
  const res = buildWallEntity(params, '0', 'straight', 'mm');
  if (!res.ok) throw new Error(`wall build failed: ${res.hardErrors.join('; ')}`);
  return res.entity;
}

/** Τέσσερις τοίχοι που κλείνουν ένα ~3×3 m ορθογώνιο δωμάτιο (κοινές γωνιακές κορυφές). */
function rectRoomWalls(w = 3000, d = 3000): Entity[] {
  return [
    wall(0, 0, w, 0),
    wall(w, 0, w, d),
    wall(w, d, 0, d),
    wall(0, d, 0, 0),
  ] as unknown as Entity[];
}

const isInside = (poly: readonly Point2D[], p: Point2D): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

describe('extractLineSegments — structuralFootprints opt-in', () => {
  it('emits NO segments for BIM walls by default (line-only, μη-regression)', () => {
    const segs = extractLineSegments(rectRoomWalls());
    expect(segs).toHaveLength(0);
  });

  it('emits footprint-edge segments for BIM walls when opted in', () => {
    const segs = extractLineSegments(rectRoomWalls(), { structuralFootprints: true });
    // 4 τοίχοι × 4 ακμές footprint = 16 τμήματα (κάθε footprint κλειστός δακτύλιος).
    expect(segs.length).toBeGreaterThanOrEqual(16);
  });
});

describe('getCachedRegionPerimeters — wall-bounded room', () => {
  it('does NOT detect a wall-only room without the flag', () => {
    const perimeters = getCachedRegionPerimeters(rectRoomWalls(), 50, 50, false);
    expect(perimeters).toHaveLength(0);
  });

  it('detects the wall-bounded room with the flag (contains the room centre)', () => {
    const perimeters = getCachedRegionPerimeters(rectRoomWalls(), 50, 50, true);
    expect(perimeters.length).toBeGreaterThan(0);
    // Ένα από τα ανιχνευμένα loops περικλείει το κέντρο του δωματίου (1500,1500).
    const containsCentre = perimeters.some((p) => isInside(p.polygon, { x: 1500, y: 1500 }));
    expect(containsCentre).toBe(true);
  });
});

describe('detectSpaces — recognition is wall-aware (ADR-638)', () => {
  it('recognises a room bounded only by BIM walls as a space', () => {
    const spaces = detectSpaces(rectRoomWalls(), '0', 'mm');
    expect(spaces.length).toBeGreaterThan(0);
    // Το εμβαδόν είναι της τάξης ενός δωματίου ~3×3 m (interior < 9 m², wall-bounded).
    expect(spaces.some((s) => s.area > 0)).toBe(true);
  });
});
