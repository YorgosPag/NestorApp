/**
 * Wall axis (location line) clip — ADR-509 (§axis-clip).
 *
 * Ο διακεκομμένος άξονας (centerline) του τοίχου ΔΕΝ πρέπει να «διαπερνά» το σώμα
 * μιας κολώνας: όπως σε Revit/AutoCAD, η location line σταματά στην παρειά του
 * άλλου δομικού σώματος. Αυτό το module κόβει την axis polyline ώστε να
 * ζωγραφίζεται ΜΟΝΟ το τμήμα ΕΞΩ από τα δοθέντα footprints (π.χ. κολώνες).
 *
 * FULL SSoT reuse: το «ποιο κομμάτι είναι μέσα» έρχεται από το ΕΝΑ
 * `coveredIntervals` + `exposedComplement` (segment-polygon-coverage) — το ίδιο
 * SSoT που τροφοδοτεί τον σοβά (ADR-449) και τον wall host-plan builder (ADR-401).
 * Μηδέν νέα geometry.
 *
 * Pure: zero React/DOM/canvas — world/plan space in, world/plan runs out.
 */
import {
  coveredIntervals,
  exposedComplement,
  type Pt2,
} from '../geometry/shared/segment-polygon-coverage';

/** Αριθμητικό όριο: t «αγγίζει» άκρο segment (0 ή 1). */
const T_EDGE_EPS = 1e-9;

const lerp = (a: Pt2, b: Pt2, t: number): Pt2 => ({
  x: a.x + t * (b.x - a.x),
  y: a.y + t * (b.y - a.y),
});

/**
 * Κόβει την `points` polyline ώστε να μείνουν ΜΟΝΟ τα τμήματα ΕΞΩ από όλα τα
 * `polygons`. Επιστρέφει λίστα από runs (κάθε run = συνεχής polyline ≥2 σημείων).
 *
 * Τα εκτεθειμένα κομμάτια που είναι συνεχή διαμέσου κορυφών της polyline
 * αλυσιδώνονται σε ΕΝΑ run → διατηρεί συνέχεια dash pattern όταν κανένα polygon
 * δεν διακόπτει τη γραμμή (μηδέν οπτικό regression σε τοίχο χωρίς κολώνα).
 *
 * `polygons` άδειο → επιστρέφει `[points]` (copy) αυτούσια — μηδέν κόστος.
 */
export function clipPolylineOutsidePolygons(
  points: readonly Pt2[],
  polygons: readonly (readonly Pt2[])[],
): Pt2[][] {
  if (points.length < 2) return [];
  if (polygons.length === 0) return [points.map((p) => ({ x: p.x, y: p.y }))];

  const runs: Pt2[][] = [];
  let current: Pt2[] = [];
  const flush = (): void => {
    if (current.length >= 2) runs.push(current);
    current = [];
  };

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    // Coverage από ΟΛΑ τα polygons αθροιστικά (≥2 κολώνες στο ίδιο segment).
    const covered = polygons.flatMap((poly) => coveredIntervals(a, b, poly));
    const exposed = exposedComplement(covered);
    if (exposed.length === 0) {
      flush(); // όλο το segment καλυμμένο → σπάσε τη συνέχεια
      continue;
    }
    for (let k = 0; k < exposed.length; k++) {
      const [t0, t1] = exposed[k];
      const p0 = lerp(a, b, t0);
      const p1 = lerp(a, b, t1);
      // Πρώτο εκτεθειμένο που ξεκινά στην αρχή του segment → αλυσίδωσε στο ανοιχτό
      // run (τελευταίο σημείο ≡ a ≡ p0)· αλλιώς ξεκίνα νέο run.
      if (k === 0 && t0 <= T_EDGE_EPS && current.length > 0) {
        current.push(p1);
      } else {
        flush();
        current = [p0, p1];
      }
      // Δεν φτάνει στο τέλος του segment → ακολουθεί κενό (polygon) → κλείσε το run.
      if (t1 < 1 - T_EDGE_EPS) flush();
    }
  }
  flush();
  return runs;
}
