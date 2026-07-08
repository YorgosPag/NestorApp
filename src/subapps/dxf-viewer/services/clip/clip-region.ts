/**
 * clip-region — big-player region-strategy SSoT για το crop.
 *
 * Οι δύο crop τρόποι (ορθογώνιο / πολύγωνο-λάσσο) διαφέρουν ΜΟΝΟ σε 4 γεωμετρικά
 * primitives. Τα per-type entity clippers (`clip-entity.ts`) γράφονται ΜΙΑ φορά ενάντια
 * σε αυτό το interface· κάθε crop τρόπος παρέχει τη δική του υλοποίηση (strategy pattern —
 * όπως AutoCAD/Revit crop regions). Καμία per-type λογική δεν διπλασιάζεται πλέον.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SpatialBounds } from '../../types/entity-bounds';
import {
  type ClipRect, inRect, liangBarsky, sutherlandRect, rectBboxOverlap,
  pointInPolygon, sutherlandGeneral, clipSegmentByPolygon, bboxOverlapsPolygon,
} from './clip-geometry';

/** A clip region (rectangular window OR freehand polygon/lasso). */
export interface ClipRegion {
  /** Point-in-region test (exact). */
  containsPoint(p: Point2D): boolean;
  /** Clip a segment → the inside sub-segments (0 for rect, N for concave polygon). */
  clipSegment(a: Point2D, b: Point2D): Array<[Point2D, Point2D]>;
  /** Clip a closed polygon loop → clipped vertices (empty if fully outside). */
  clipLoop(verts: Point2D[]): Point2D[];
  /** Does an axis-aligned bbox overlap the region? (all-or-nothing bbox cull) */
  bboxOverlaps(b: SpatialBounds): boolean;
}

/** Rectangular window region — Liang-Barsky + Sutherland-Hodgman-rect (exact, fast). */
export class RectClipRegion implements ClipRegion {
  constructor(private readonly rect: ClipRect) {}

  containsPoint(p: Point2D): boolean {
    return inRect(p, this.rect);
  }

  clipSegment(a: Point2D, b: Point2D): Array<[Point2D, Point2D]> {
    const { xMin, yMin, xMax, yMax } = this.rect;
    const seg = liangBarsky(a.x, a.y, b.x, b.y, xMin, yMin, xMax, yMax);
    return seg ? [[{ x: seg[0], y: seg[1] }, { x: seg[2], y: seg[3] }]] : [];
  }

  clipLoop(verts: Point2D[]): Point2D[] {
    return sutherlandRect(verts, this.rect);
  }

  bboxOverlaps(b: SpatialBounds): boolean {
    return rectBboxOverlap(b, this.rect);
  }
}

/** Freehand polygon/lasso region — parametric segment-polygon + S-H-general (concave-approx). */
export class PolygonClipRegion implements ClipRegion {
  constructor(private readonly poly: Array<[number, number]>) {}

  containsPoint(p: Point2D): boolean {
    return pointInPolygon(p, this.poly);
  }

  clipSegment(a: Point2D, b: Point2D): Array<[Point2D, Point2D]> {
    return clipSegmentByPolygon(a.x, a.y, b.x, b.y, this.poly)
      .map(([x1, y1, x2, y2]) => [{ x: x1, y: y1 }, { x: x2, y: y2 }] as [Point2D, Point2D]);
  }

  clipLoop(verts: Point2D[]): Point2D[] {
    return sutherlandGeneral(verts, this.poly);
  }

  bboxOverlaps(b: SpatialBounds): boolean {
    return bboxOverlapsPolygon(b, this.poly);
  }
}
