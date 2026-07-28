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
 * ── ΤΑ ΔΥΟ ΠΛΑΙΣΙΑ (ADR-718 §Α) — εδώ το σφάλμα ήταν ΣΙΩΠΗΛΟ ────────────────────────────────
 * Δίδυμο του `topo-boundary-pick`: η γραμμή ζει σε **DISPLAY**, ο `TopoPoint` δηλώνεται
 * **WORLD** (`topo-types.ts`) και καταλήγει constrained edge στον CDT — δηλαδή μέρος του
 * **ορισμού** της επιφάνειας, όχι της εμβέλειάς της.
 *
 * Η αστοχία εδώ ήταν χειρότερη από το όριο, γιατί δεν φαινόταν: το `nearestElevation` συνέκρινε
 * **DISPLAY κορυφή με WORLD σημεία**. Σε γεωαναφερμένο έργο η απόσταση κυριαρχείται από τη
 * μετάθεση (~4·10⁸ mm), οπότε **κάθε** κορυφή έπαιρνε το z του ίδιου αυθαίρετου σημείου: μια
 * ασυνέχεια που φαίνεται σωστή, επιβάλλεται στην τριγωνοποίηση, και παραμορφώνει το ανάγλυφο —
 * χωρίς κανένα ορατό σύμπτωμα. Κενή επιφάνεια είναι ορατή· λάθος υψόμετρο δεν είναι.
 *
 * Άρα το unproject γίνεται **πριν** από οτιδήποτε άλλο διαβάσει τις κορυφές, και ο projector
 * είναι **υποχρεωτική** παράμετρος για τον ίδιο λόγο που είναι και στο όριο (δύο καλούντες).
 *
 * @see ./TopoPointStore — raw SSoT (points + breaklines)
 * @see ./tin-builder — καταναλωτής των constraints (constrained edges στο CDT)
 * @see ./topo-boundary-pick — ο δίδυμος builder· ΙΔΙΑ σύμβαση πλαισίου, όχι κατά τύχη
 */

import type { Entity } from '../../types/entities';
import { isLineEntity, isPolylineEntity, isLWPolylineEntity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import type { WorldToDisplayProjector } from '../geo-referencing/geo-transform';
import { unprojectDisplayPoints } from './topo-display-frame';
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

/** Οι κορυφές (DISPLAY) της γραμμικής οντότητας + αν είναι κλειστή. `null` αν δεν είναι υποψήφια. */
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
 *
 * @param projector ο ενεργός WORLD→DISPLAY (`getTopoDisplayProjector()`), ή `null` σε
 *   μη-γεωαναφερμένο έργο. Οι κορυφές ανεβαίνουν σε WORLD **πριν** ρωτηθεί το `nearestElevation`,
 *   γιατί τα σημεία με τα οποία συγκρίνονται ζουν κι εκείνα σε WORLD.
 */
export function buildBreaklineFromEntity(
  entity: Entity,
  points: readonly TopoPoint[],
  projector: WorldToDisplayProjector | null,
): BuiltBreakline | null {
  const poly = extractPolyline(entity);
  if (!poly || poly.vertices.length < 2) return null;

  // Η ΜΙΑ μετάβαση πλαισίου, πριν από κάθε ανάγνωση των κορυφών (ADR-718 §Α).
  const vertices = unprojectDisplayPoints(poly.vertices, projector);

  // (1) standard breakline — η γραμμή κουβαλά το δικό της, ρητό υψόμετρο.
  // Το `elevation` είναι **Z** και ο μετασχηματισμός είναι επίπεδος (M10b: «Z is never touched»),
  // οπότε περνά αυτούσιο — ακριβώς όπως το `level` μιας ισοϋψούς στο `projectContourLines`.
  const elevation = isLWPolylineEntity(entity) ? entity.elevation : undefined;
  if (typeof elevation === 'number' && Number.isFinite(elevation)) {
    return {
      vertices: vertices.map((v) => ({ x: v.x, y: v.y, z: elevation })),
      closed: poly.closed,
      source: 'elevation',
    };
  }

  // (2) proximity breakline — το z δανείζεται από την ίδια την αποτύπωση.
  if (points.length === 0) return null;
  return {
    vertices: vertices.map((v) => ({ x: v.x, y: v.y, z: nearestElevation(v, points) })),
    closed: poly.closed,
    source: 'proximity',
  };
}
