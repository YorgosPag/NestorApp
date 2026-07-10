/**
 * ADR-531 Φ5b.3 — «Μόνο κάτοψη DXF» (plan-lines): pure γεωμετρία των **καθαρών γραμμών** ενός
 * BIM τοίχου, όπως το top-view του Τέκτονα — περίγραμμα παρειών **κομμένο στα ανοίγματα** + jamb
 * returns + ακραία caps. Μηδέν canvas/store — ο `WallRenderer` (plan-lines branch) κάνει μόνο stroke.
 *
 * Διαβάζει την ΥΠΟΛΟΓΙΣΜΕΝΗ γεωμετρία του τοίχου (`geometry.outerEdge`/`innerEdge`, SSoT
 * `computeWallGeometry`) + τα hosted openings (offsetFromStart/width). Straight-wall scope (ο Τέκτων
 * import παράγει `kind:'straight'`)· για curved/polyline → fallback στο πλήρες κλειστό περίγραμμα.
 *
 * @module bim/walls/wall-plan-line-segments
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../types/bim-base';
import type { WallEntity } from '../types/wall-types';
import type { OpeningEntity } from '../types/opening-types';
import { clamp01 } from '../../rendering/entities/shared/geometry-utils';

/** Ένα ευθύγραμμο τμήμα σε scene units. */
export interface PlanLineSeg {
  readonly a: Point2D;
  readonly b: Point2D;
}

/** Παραμετρικό σημείο κατά μήκος μιας ευθείας ακμής 2 κορυφών (t∈[0,1]). */
function lerpEdge(edge: readonly Point3D[], t: number): Point2D {
  const a = edge[0];
  const b = edge[edge.length - 1];
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

/** Τα ανοίγματα → ταξινομημένα, ενωμένα διαστήματα [t0,t1]⊆[0,1] κατά μήκος του άξονα. */
function openingIntervals(
  wall: WallEntity,
  openings: readonly OpeningEntity[],
): [number, number][] {
  const wallLenMm = wall.geometry.length * 1000;
  if (wallLenMm <= 1e-6) return [];
  return openings
    .filter((o) => o.params.wallId === wall.id)
    .map((o): [number, number] => [
      clamp01(o.params.offsetFromStart / wallLenMm),
      clamp01((o.params.offsetFromStart + o.params.width) / wallLenMm),
    ])
    .filter(([t0, t1]) => t1 - t0 > 1e-6)
    .sort((a, b) => a[0] - b[0]);
}

/** Μία παρειά (edge) κομμένη στα διαστήματα ανοιγμάτων → τα ορατά τμήματά της. */
function cutEdge(edge: readonly Point3D[], intervals: readonly [number, number][]): PlanLineSeg[] {
  const out: PlanLineSeg[] = [];
  let cursor = 0;
  for (const [t0, t1] of intervals) {
    if (t0 > cursor) out.push({ a: lerpEdge(edge, cursor), b: lerpEdge(edge, t0) });
    cursor = Math.max(cursor, t1);
  }
  if (cursor < 1) out.push({ a: lerpEdge(edge, cursor), b: lerpEdge(edge, 1) });
  return out;
}

/** Το πλήρες (μη κομμένο) κλειστό περίγραμμα outer+inner + caps — fallback για μη-straight. */
function fullOutline(outer: readonly Point3D[], inner: readonly Point3D[]): PlanLineSeg[] {
  const to2 = (p: Point3D): Point2D => ({ x: p.x, y: p.y });
  const segs: PlanLineSeg[] = [];
  for (let i = 0; i < outer.length - 1; i++) segs.push({ a: to2(outer[i]), b: to2(outer[i + 1]) });
  for (let i = 0; i < inner.length - 1; i++) segs.push({ a: to2(inner[i]), b: to2(inner[i + 1]) });
  if (outer.length && inner.length) {
    segs.push({ a: to2(outer[0]), b: to2(inner[0]) });
    segs.push({ a: to2(outer[outer.length - 1]), b: to2(inner[inner.length - 1]) });
  }
  return segs;
}

/**
 * Καθαρές γραμμές κάτοψης ενός τοίχου: παρειές κομμένες στα ανοίγματα + ακραία caps + jamb returns
 * (κάθετες στα άκρα κάθε ανοίγματος). Το σύμβολο πόρτας/παραθύρου το ζωγραφίζει ο `OpeningRenderer`.
 */
export function wallPlanLineSegments(
  wall: WallEntity,
  openings: readonly OpeningEntity[],
): PlanLineSeg[] {
  const outer = wall.geometry.outerEdge.points;
  const inner = wall.geometry.innerEdge.points;
  if (outer.length < 2 || inner.length < 2) return [];
  // Straight τοίχος = ακριβώς 2 κορυφές ανά παρειά· αλλιώς (curved/polyline) → πλήρες περίγραμμα.
  if (wall.kind !== 'straight' || outer.length !== 2 || inner.length !== 2) {
    return fullOutline(outer, inner);
  }
  const intervals = openingIntervals(wall, openings);
  const segs: PlanLineSeg[] = [...cutEdge(outer, intervals), ...cutEdge(inner, intervals)];
  // Ακραία caps (κλείνουν τον τοίχο στα δύο άκρα).
  segs.push({ a: lerpEdge(outer, 0), b: lerpEdge(inner, 0) });
  segs.push({ a: lerpEdge(outer, 1), b: lerpEdge(inner, 1) });
  // Jamb returns: κάθετη γραμμή στα δύο άκρα κάθε ανοίγματος (η «παρειά» του κουφώματος).
  for (const [t0, t1] of intervals) {
    segs.push({ a: lerpEdge(outer, t0), b: lerpEdge(inner, t0) });
    segs.push({ a: lerpEdge(outer, t1), b: lerpEdge(inner, t1) });
  }
  return segs;
}
