/**
 * Wall-end ↔ column pull-back (3Δ-only) — ADR-449 #2/#C (junction z-fight fix).
 *
 * Όταν η άκρη ενός ίσιου τοίχου κουμπώνει **flush** πάνω στην παρειά μιας κολόνας
 * (snap → το end-point κάθεται ΑΚΡΙΒΩΣ στο footprint της κολόνας), το `ExtrudeGeometry`
 * παράγει end-cap **coincident** με την παρειά της κολόνας → δύο επιφάνειες στο ίδιο
 * επίπεδο → **z-fighting** (φαίνεται «σοβάς» στη στενή όψη του τοίχου).
 *
 * **Λύση = pull-back** (η άκρη **υποχωρεί** λίγα mm μακριά από την κολόνα, κατά τον άξονα):
 *   - Μηδενίζει τη σύμπτωση επιφανειών → **τέλος z-fight**.
 *   - Το end-cap του τοίχου είναι πλέον στραμμένο προς την κολόνα και **occluded** από το
 *     συμπαγές μπετόν της → δεν φαίνεται η «στενή όψη με σοβά» (το αρχικό #2).
 *   - **#C fix:** σε αντίθεση με το παλιό *embed* (που έσπρωχνε 20mm τοίχο ΜΕΣΑ στην κολόνα),
 *     το pull-back αφήνει **ΜΗΔΕΝ** geometry τοίχου μέσα στο σώμα της κολόνας. Έτσι, όταν ο
 *     ADR-452 cut-plane slider κινείται και τα cut-caps της κολόνας είναι προσωρινά OFF
 *     (ανοιχτή τομή), ΔΕΝ υπάρχει εμβυθισμένος σοβάς τοίχου να «διαρρεύσει» μέσα στην κολόνα.
 *
 * **3Δ-only & render-only:** δεν αλλάζει η αποθηκευμένη θέση/μήκος του τοίχου (Δρόμος Β —
 * ο τοίχος μένει εκεί που τον έβαλε ο χρήστης). Η μετατόπιση εφαρμόζεται σε **τοπικό
 * αντίγραφο** της geometry+start/end που τρέφει ΜΟΝΟ τον mesh builder· 2Δ κάτοψη, BOQ,
 * finish-obstacle (η αφαίρεση σοβά κολόνας) διαβάζουν το ΑΡΧΙΚΟ wall → αμετάβλητα.
 *
 * Surgical (όχι recompute): μετατοπίζει ΜΟΝΟ τις κορυφές του άκρου που κουμπώνει
 * (`points[0]` = start-side, `points[last]` = end-side, μαζί με το αντίστοιχο axis endpoint),
 * κατά τον άξονα προς τα μέσα (μακριά από την κολόνα) → διατηρεί miters/edges των άλλων άκρων.
 *
 * Pure — μηδέν THREE/store. REUSE canonical `pointInPolygon` (polygon-utils) +
 * `pointToSegmentDistance` (systems/guides) — ΟΧΙ duplicate low-level geometry.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import type { Point3D } from '../../bim/types/bim-base';
import { pointInPolygon } from '../../bim/geometry/shared/polygon-utils';
import { pointToSegmentDistance } from '../../systems/guides/guide-types';

/**
 * Βάθος υποχώρησης άκρου τοίχου μακριά από την κολόνα (mm). Αρκετά μικρό ώστε το κενό να
 * είναι **οπτικά αμελητέο** στη συμβολή, αλλά αρκετό ώστε να μηδενίσει τη σύμπτωση
 * επιφανειών (τέλος z-fight) σε όλο το εύρος του depth buffer. ΟΧΙ embed (#C: μηδέν
 * geometry μέσα στην κολόνα).
 */
export const WALL_COLUMN_PULLBACK_MM = 2;
/** Ανοχή (mm) ώστε ένα end-point να θεωρηθεί ότι «κουμπώνει» σε κολόνα (snap → ~0· margin για float drift). */
export const WALL_COLUMN_BUTT_TOL_MM = 5;

/** Patched (τοπικά) edges + axis + start/end του τοίχου, με την/τις υποχωρημένη/ες άκρη/ες. */
export interface WallEndPullBack {
  readonly outer: Point3D[];
  readonly inner: Point3D[];
  readonly axis: Point3D[];
  readonly start: Point3D;
  readonly end: Point3D;
}

interface WallPullBackGeometry {
  readonly outerEdge: { readonly points: readonly Point3D[] };
  readonly innerEdge: { readonly points: readonly Point3D[] };
  readonly axisPolyline: { readonly points: readonly Point3D[] };
}

/** `true` όταν το `p` κάθεται μέσα ή στην περίμετρο (≤tol) ΕΝΟΣ column footprint. */
function endpointButtsColumn(
  p: { readonly x: number; readonly y: number },
  columns: readonly (readonly Point3D[])[],
  tol: number,
): boolean {
  for (const poly of columns) {
    if (poly.length < 3) continue;
    if (pointInPolygon(p, poly)) return true;
    for (let i = 0; i < poly.length; i++) {
      if (pointToSegmentDistance(p, poly[i], poly[(i + 1) % poly.length]) <= tol) return true;
    }
  }
  return false;
}

const shift = (p: Point3D, dx: number, dy: number): Point3D => ({ x: p.x + dx, y: p.y + dy, z: p.z });

/**
 * Υποχωρεί την/τις άκρη/ες ίσιου τοίχου που κουμπώνουν σε κολόνα κατά `pullBackCanvas`
 * (canvas units) κατά τον άξονα **προς τα μέσα** (μακριά από την κολόνα). Επιστρέφει `null`
 * όταν καμία άκρη δεν κουμπώνει (no-op → ο caller κρατά το αρχικό wall byte-for-byte).
 */
export function pullBackStraightWallEndsFromColumns(
  geometry: WallPullBackGeometry,
  start: Point3D,
  end: Point3D,
  columns: readonly (readonly Point3D[])[],
  pullBackCanvas: number,
  buttTol: number,
): WallEndPullBack | null {
  if (columns.length === 0 || pullBackCanvas <= 0) return null;
  const outer = [...geometry.outerEdge.points];
  const inner = [...geometry.innerEdge.points];
  const axis = [...geometry.axisPolyline.points];
  if (outer.length < 2 || inner.length < 2 || axis.length < 2) return null;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  const ux = dx / len;
  const uy = dy / len;

  let s = start;
  let e = end;
  let changed = false;

  // Start-side: η κολόνα είναι στην −u πλευρά → υποχώρηση = +u (μακριά της, ο τοίχος κονταίνει).
  if (endpointButtsColumn(start, columns, buttTol)) {
    const mx = ux * pullBackCanvas;
    const my = uy * pullBackCanvas;
    outer[0] = shift(outer[0], mx, my);
    inner[0] = shift(inner[0], mx, my);
    axis[0] = shift(axis[0], mx, my);
    s = shift(start, mx, my);
    changed = true;
  }
  // End-side: η κολόνα είναι στην +u πλευρά → υποχώρηση = −u.
  if (endpointButtsColumn(end, columns, buttTol)) {
    const mx = -ux * pullBackCanvas;
    const my = -uy * pullBackCanvas;
    outer[outer.length - 1] = shift(outer[outer.length - 1], mx, my);
    inner[inner.length - 1] = shift(inner[inner.length - 1], mx, my);
    axis[axis.length - 1] = shift(axis[axis.length - 1], mx, my);
    e = shift(end, mx, my);
    changed = true;
  }

  if (!changed) return null;
  return { outer, inner, axis, start: s, end: e };
}
