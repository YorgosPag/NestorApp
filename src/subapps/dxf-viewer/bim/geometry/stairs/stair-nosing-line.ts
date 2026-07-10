/**
 * ADR-632 — Nosing-line SSoT για σκάλες.
 *
 * Δεν υπήρχε dedicated helper: το `nosing` param έμπαινε μόνο ως extra βάθος
 * στο tread quad (`stair-geometry-generators.ts`). Εδώ εξάγουμε ανά σκαλοπάτι
 * το «σημείο μύτης» (leading-edge midpoint) μαζί με το ύψος του (z), ώστε ο
 * headroom έλεγχος + το auto-opening κλιμακοστασίου να δουλεύουν στη σωστή
 * γραμμή αναφοράς — τη nosing line (γραμμή που ενώνει τις μύτες), όπως ορίζουν
 * IBC §1011.3 και Κτιριοδομικός Άρθρο 13.
 *
 * Pure — μηδέν React / DOM / Firestore. Coords στις μονάδες της σκηνής (scene
 * units), όπως το `StairGeometry` (ADR-358 §9.2 Q22).
 */

import type { Point3D, Polygon3D } from '../../types/bim-base';
import { directionToUnitVector, type Vec2 } from './stair-geometry-shared';

export interface StairNosing {
  /** Global tread index (0-based) στη σειρά ανόδου. */
  readonly treadIndex: number;
  /** Μέσο της εμπρός (nosing) ακμής του σκαλοπατιού· z = επιφάνεια πατήματος. */
  readonly point: Point3D;
}

/**
 * Leading (nosing) edge midpoint κάθε σκαλοπατιού. Για κάθε tread polygon
 * βρίσκουμε τις 2 κορυφές με τη ΜΕΓΑΛΥΤΕΡΗ προβολή κατά τη φορά ανόδου `u`
 * (= η εμπρός ακμή, εκεί που προεξέχει το nosing) και παίρνουμε το μέσο τους.
 * Δουλεύει για ευθύγραμμα / L / U / gamma flights· για radial/winder δίνει το
 * κοντινότερο λογικό σημείο (η `u` = κυρίαρχη φορά flight).
 *
 * @param treads      `StairGeometry.treads` (κάθε ένα z-positioned στο ύψος του).
 * @param directionDeg φορά ανόδου (μοίρες, 0 = +X) — `StairParams.direction`.
 */
export function computeStairNosings(
  treads: readonly Polygon3D[],
  directionDeg: number,
): StairNosing[] {
  const u = directionToUnitVector(directionDeg);
  const result: StairNosing[] = [];
  for (let i = 0; i < treads.length; i++) {
    const nosing = leadingEdgeMidpoint(treads[i], u);
    if (nosing) result.push({ treadIndex: i, point: nosing });
  }
  return result;
}

/** Μέσο των 2 κορυφών με max προβολή κατά `u` (εμπρός/nosing ακμή). */
function leadingEdgeMidpoint(tread: Polygon3D, u: Vec2): Point3D | null {
  const vs = tread.vertices;
  if (vs.length < 3) return null;
  let i1 = 0;
  let i2 = -1;
  let best1 = -Infinity;
  let best2 = -Infinity;
  for (let i = 0; i < vs.length; i++) {
    const proj = vs[i].x * u.x + vs[i].y * u.y;
    if (proj > best1) {
      best2 = best1;
      i2 = i1;
      best1 = proj;
      i1 = i;
    } else if (proj > best2) {
      best2 = proj;
      i2 = i;
    }
  }
  if (i2 < 0) return null;
  const a = vs[i1];
  const b = vs[i2];
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
  };
}
