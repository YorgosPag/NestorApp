/**
 * ADR-449 §angled-wall-miter-close — SSoT υπολογισμός plan footprint τοίχου για τον σοβά.
 *
 * Εξάχθηκε από το `structural-finish-scene.ts` (commit-split: το αρχείο πέρασε το όριο 500)
 * ώστε η μηχανή «raw + mitered union» να ζει σε ΕΝΑ αυτόνομο, δοκιμάσιμο module. Το public
 * API (`wallFootprintPolygon`) επανεξάγεται από το `structural-finish-scene` → μηδέν αλλαγή
 * στους καταναλωτές.
 */

import type { MultiPolygon, Pair, Polygon } from 'polygon-clipping';
import { computeWallGeometry } from '../geometry/wall-geometry';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
import { safeUnion } from '../geometry/shared/safe-polygon-boolean';
import { toPt2, type WallFinishObstacle } from './structural-finish-scene';

/** Wall → plan footprint (outer + reversed inner) από τα δοσμένα params (miters ενσωματωμένα). */
function wallFootprintFromParams(params: WallFinishObstacle['params'], kind: WallFinishObstacle['kind']): Pt2[] {
  const g = computeWallGeometry(params, kind);
  const outer = g.outerEdge.points.map(toPt2);
  const inner = [...g.innerEdge.points].reverse().map(toPt2);
  return [...outer, ...inner];
}

/** Pt2[] → CCW polygon-clipping Polygon (winding-normalised, κλειστό ring). */
function finishFootprintToClip(fp: readonly Pt2[]): Polygon {
  let s = 0;
  for (let i = 0; i < fp.length; i++) { const a = fp[i]; const b = fp[(i + 1) % fp.length]; s += a.x * b.y - b.x * a.y; }
  const ccw = s < 0 ? [...fp].reverse() : fp;
  const ring: Pair[] = ccw.map((p) => [p.x, p.y]);
  if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
    ring.push([ring[0][0], ring[0][1]]);
  }
  return [ring];
}

/** Μεγαλύτερο (κατ' απόλυτο εμβαδό) outer ring μιας MultiPolygon → Pt2[]. `null` αν κενή. */
function largestUnionOuterRing(mp: MultiPolygon): Pt2[] | null {
  let best: Pt2[] | null = null;
  let bestArea = -Infinity;
  for (const poly of mp) {
    const r = poly[0];
    if (!r || r.length < 4) continue;
    const pts: Pt2[] = [];
    const lim = r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.length - 1 : r.length;
    for (let i = 0; i < lim; i++) pts.push({ x: r[i][0], y: r[i][1] });
    let s = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i]; const b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; }
    if (Math.abs(s) > bestArea) { bestArea = Math.abs(s); best = pts; }
  }
  return best;
}

/**
 * Wall → plan footprint (canvas units) για τον σοβά. **ADR-449 §angled-wall-miter-close:**
 * επιστρέφει την ΕΝΩΣΗ του **raw** rect (αγνοεί miters/bevels) με το **mitered** footprint:
 *   · **raw** → επικαλύπτεται με κολόνα σε flush wall↔column join → robust union (§merged-union-
 *     robustness, δεν γίνεται degenerate collinear touch)·
 *   · **mitered** → κλείνει την ΕΣΩΤΕΡΙΚΗ (reflex) γωνία δύο τοίχων υπό γωνία (το inner miter
 *     σημείο γεμίζει το ~35mm notch που άφηνε το σκέτο raw → ο σοβάς σέβεται πλέον το miter).
 * Η ένωση είναι **υπερσύνολο** του raw → η outer robustness (wall↔column) διατηρείται 1:1. Χωρίς
 * join trims (ελεύθερος τοίχος) → mitered ≡ raw → fast-path επιστρέφει raw (μηδέν αλλαγή/union).
 */
export function wallFootprintPolygon(wall: WallFinishObstacle): Pt2[] {
  const { startMiter, endMiter, startBevel, endBevel, ...rawParams } = wall.params;
  const raw = wallFootprintFromParams(rawParams as WallFinishObstacle['params'], wall.kind);
  // Ελεύθερος τοίχος (κανένα join trim) → mitered ≡ raw → μηδέν union, μηδέν αλλαγή.
  if (!startMiter && !endMiter && !startBevel && !endBevel) return raw;
  const mitered = wallFootprintFromParams(wall.params, wall.kind);
  const merged = safeUnion(finishFootprintToClip(raw), finishFootprintToClip(mitered));
  return largestUnionOuterRing(merged) ?? raw;
}
