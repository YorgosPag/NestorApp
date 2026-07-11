/**
 * Room wall segmentation + fixture rectangle geometry · ADR-638.
 *
 * Turns a CCW room polygon into per-edge {@link RoomWall}s (each with its unit
 * along-direction + inward normal) and builds the wall-hugging footprint + front
 * use-zone rectangles for a fixture placed at a given position along a wall. Pure,
 * millimetres. Reuses the polygon SSoT (`isPolygonCCW`) — no duplicate winding math.
 */

import type { Point2D } from '../../rendering/types/Types';
import { isPolygonCCW } from '../../bim/geometry/shared/polygon-utils';

/** One boundary edge of the room, oriented so its inward normal points inside. */
export interface RoomWall {
  readonly index: number;
  /** Edge start (mm). */
  readonly a: Point2D;
  /** Edge end (mm). */
  readonly b: Point2D;
  /** Unit vector a→b (along the wall). */
  readonly dir: Point2D;
  /** Unit inward normal (points into the room; CCW left normal). */
  readonly inward: Point2D;
  /** Edge length (mm). */
  readonly lengthMm: number;
}

/** Ensure CCW winding (interior on the left of each directed edge). */
function ensureCCW(polygon: readonly Point2D[]): Point2D[] {
  const lifted = polygon.map((p) => ({ x: p.x, y: p.y, z: 0 }));
  return isPolygonCCW(lifted) ? [...polygon] : [...polygon].reverse();
}

/**
 * Segment a room polygon into oriented walls. Degenerate (near-zero-length) edges
 * are dropped. Output wall `index` is contiguous over the surviving edges.
 */
export function segmentRoomWalls(polygon: readonly Point2D[]): RoomWall[] {
  const ccw = ensureCCW(polygon);
  const n = ccw.length;
  const walls: RoomWall[] = [];
  for (let i = 0; i < n; i++) {
    const a = ccw[i];
    const b = ccw[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const dir = { x: dx / len, y: dy / len };
    walls.push({
      index: walls.length,
      a,
      b,
      dir,
      inward: { x: -dir.y, y: dir.x }, // CCW left normal = inward
      lengthMm: len,
    });
  }
  return walls;
}

/** The rectangles + pose produced for a fixture placed against a wall. */
export interface PlacedRects {
  /** Footprint corners, CCW, mm. */
  readonly footprint: Point2D[];
  /** Front approach clearance rectangle, CCW, mm. */
  readonly useZone: Point2D[];
  /** Footprint centroid (insertion point), mm. */
  readonly center: Point2D;
  /** Degrees CCW; local +Y (depth) points into the room (= inward normal). */
  readonly rotationDeg: number;
}

/**
 * Build the footprint + front use-zone for a fixture whose back sits on `wall`,
 * centred at arc-length `centerS` (mm from `wall.a`). `widthMm` runs along the
 * wall, `depthMm` into the room, `frontMm` extends the use-zone beyond the front
 * face. Winding is CCW for both rectangles (validated: dir × inward = +1).
 */
export function buildFixtureRects(
  wall: RoomWall,
  centerS: number,
  widthMm: number,
  depthMm: number,
  frontMm: number,
): PlacedRects {
  const u = wall.dir;
  const nrm = wall.inward;
  const hw = widthMm / 2;
  const backCx = wall.a.x + u.x * centerS;
  const backCy = wall.a.y + u.y * centerS;
  const bl = { x: backCx - u.x * hw, y: backCy - u.y * hw };
  const br = { x: backCx + u.x * hw, y: backCy + u.y * hw };
  const fr = { x: br.x + nrm.x * depthMm, y: br.y + nrm.y * depthMm };
  const fl = { x: bl.x + nrm.x * depthMm, y: bl.y + nrm.y * depthMm };
  const zoneD = depthMm + frontMm;
  const zr = { x: br.x + nrm.x * zoneD, y: br.y + nrm.y * zoneD };
  const zl = { x: bl.x + nrm.x * zoneD, y: bl.y + nrm.y * zoneD };
  return {
    footprint: [bl, br, fr, fl],
    useZone: [bl, br, zr, zl],
    center: { x: (bl.x + fr.x) / 2, y: (bl.y + fr.y) / 2 },
    rotationDeg: (Math.atan2(nrm.y, nrm.x) * 180) / Math.PI,
  };
}
