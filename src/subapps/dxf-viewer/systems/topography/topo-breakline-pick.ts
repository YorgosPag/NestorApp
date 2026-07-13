/**
 * ADR-650 M2 μέρος Β — pure core: «υπάρχουσα γραμμή του σχεδίου → breakline constraint».
 *
 * Το scene είναι **2D**: `LineEntity` / `PolylineEntity` ΔΕΝ έχουν z· μόνο το
 * `LWPolylineEntity` κουβαλά `elevation`. Άρα το υψόμετρο μιας breakline προκύπτει με τη
 * διάκριση του **Civil 3D**:
 *
 *  1. **standard breakline** — `lwpolyline.elevation` ορισμένο ⇒ ΟΛΕΣ οι κορυφές στο ίδιο z
 *     (η γραμμή είναι πραγματικά υψομετρημένη: ακμή δρόμου σε στάθμη, κορυφογραμμή τοίχου).
 *  2. **proximity breakline** — 2D γραμμή χωρίς z ⇒ κάθε κορυφή παίρνει το z του
 *     **πλησιέστερου μετρημένου σημείου**. ΔΕΝ είναι hack: είναι το καθιερωμένο pattern του
 *     Civil 3D για 2D γραμμές. Η αξία της breakline είναι ότι επιβάλλεται ως **constrained
 *     edge** στο CDT (κρατά το κοφτό σκαλί) — ακόμη κι όταν το υψόμετρό της είναι παράγωγο.
 *
 * Χωρίς φορτωμένα σημεία, μια proximity breakline **δεν μπορεί** να χτιστεί → `null`
 * (ο caller μιλάει· ΠΟΤΕ σιωπηλά).
 *
 * @see ./TopoPointStore — raw SSoT (points + breaklines)
 * @see ./tin-builder — καταναλωτής των constraints (constrained edges στο CDT)
 */

import type { Entity } from '../../types/entities';
import { isLineEntity, isPolylineEntity, isLWPolylineEntity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import type { TopoPoint } from './topo-types';

/** Από πού προέκυψε το z της breakline (για μήνυμα/QA — Civil 3D ορολογία). */
export type BreaklineSource = 'elevation' | 'proximity';

/** Χτισμένη breakline, έτοιμη για `addBreakline`. */
export interface BuiltBreakline {
  readonly vertices: readonly TopoPoint[];
  readonly closed: boolean;
  readonly source: BreaklineSource;
}

/**
 * Ποιες οντότητες μπορεί να «γίνουν» breakline (predicate για το `pickTopEntityAt`).
 * Μόνο γραμμικές: line / polyline / lwpolyline. Το φίλτρο κρατά το pick καθαρό — μια
 * υπερκείμενη γραμμοσκίαση ή ένα κείμενο δεν κλέβει το κλικ.
 */
export function isBreaklineCandidate(entity: Entity): boolean {
  return isLineEntity(entity) || isPolylineEntity(entity) || isLWPolylineEntity(entity);
}

/** Οι κορυφές (world) της γραμμικής οντότητας + αν είναι κλειστή. `null` αν δεν είναι υποψήφια. */
function extractPolyline(entity: Entity): { vertices: readonly Point2D[]; closed: boolean } | null {
  if (isLineEntity(entity)) return { vertices: [entity.start, entity.end], closed: false };
  if (isPolylineEntity(entity) || isLWPolylineEntity(entity)) {
    return { vertices: entity.vertices, closed: entity.closed === true };
  }
  return null;
}

/** Το z του πλησιέστερου μετρημένου σημείου (squared distance — καμία ρίζα). */
function nearestElevation(vertex: Point2D, points: readonly TopoPoint[]): number {
  let bestZ = points[0].z;
  let bestD2 = Infinity;
  for (const p of points) {
    const dx = p.x - vertex.x;
    const dy = p.y - vertex.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestZ = p.z;
    }
  }
  return bestZ;
}

/**
 * Χτίζει breakline από μια γραμμική οντότητα του σχεδίου.
 *
 * Επιστρέφει `null` όταν: δεν είναι γραμμική οντότητα · έχει < 2 κορυφές · είναι 2D
 * (proximity) αλλά ΔΕΝ υπάρχουν φορτωμένα σημεία για να δώσουν υψόμετρο.
 */
export function buildBreaklineFromEntity(
  entity: Entity,
  points: readonly TopoPoint[],
): BuiltBreakline | null {
  const poly = extractPolyline(entity);
  if (!poly || poly.vertices.length < 2) return null;

  // (1) standard breakline — η γραμμή κουβαλά το δικό της, ρητό υψόμετρο.
  const elevation = isLWPolylineEntity(entity) ? entity.elevation : undefined;
  if (typeof elevation === 'number' && Number.isFinite(elevation)) {
    return {
      vertices: poly.vertices.map((v) => ({ x: v.x, y: v.y, z: elevation })),
      closed: poly.closed,
      source: 'elevation',
    };
  }

  // (2) proximity breakline — το z δανείζεται από την ίδια την αποτύπωση.
  if (points.length === 0) return null;
  return {
    vertices: poly.vertices.map((v) => ({ x: v.x, y: v.y, z: nearestElevation(v, points) })),
    closed: poly.closed,
    source: 'proximity',
  };
}
