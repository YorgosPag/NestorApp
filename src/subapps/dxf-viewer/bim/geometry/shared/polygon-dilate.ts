/**
 * Polygon outward dilation (offset) — pure geometry SSoT (ADR-449 Slice 6).
 *
 * Μεγαλώνει ένα κλειστό πολύγωνο «προς τα έξω» κατά σταθερή απόσταση `d` (miter
 * offset): κάθε ακμή μετατοπίζεται κατά `d` κατά την outward normal της και οι
 * κορυφές κλείνουν στην τομή των μετατοπισμένων ευθειών (45°-style miter, με
 * miter-limit clamp στις αιχμηρές γωνίες).
 *
 * Χρήση (ADR-449): cross-structural obstacles για τον σοβά — όταν ένα δοκάρι
 * καρφώνεται **flush** στην παρειά κολώνας (born-from-grid framing, μηδέν overlap),
 * το `coveredIntervals` (segment-polygon-coverage) ΔΕΝ θα το έπιανε γιατί απαιτεί
 * midpoint **αυστηρά μέσα** στο obstacle. Μικρή outward dilation (Revit join
 * tolerance) «γεφυρώνει» το flush seam ώστε η διεπαφή να μετράει ως καλυμμένη.
 *
 * Winding-free: η outward normal κάθε ακμής επιλέγεται ως προς το centroid (δεν
 * εξαρτάται από CW/CCW). Robust για κυρτά πολύγωνα (ορθογώνια footprints) και
 * αρκετά καλό για ήπια μη-κυρτά (curved-beam outlines) χάρη στο miter clamp.
 *
 * Pure: μηδέν globals/React/scene — 100% testable.
 */

import type { Pt2 } from './segment-polygon-coverage';
import { projectVerticesTo2D } from './polygon-utils';

const EPS = 1e-9;
/** Όριο μήκους miter (× d): αιχμηρές γωνίες δεν παράγουν spike. */
const MITER_LIMIT = 4;

/** Γεωμετρικό κέντρο (μέσος όρος κορυφών) — αρκεί για επιλογή outward direction. */
function centroidOf(poly: readonly Pt2[]): Pt2 {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

/** Μοναδιαία outward normal κάθε ακμής i (κορυφή i → i+1), flipped ως προς centroid. */
function outwardNormals(poly: readonly Pt2[], c: Pt2): Pt2[] {
  const n = poly.length;
  const out: Pt2[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = dy / len;
    let ny = -dx / len;
    const mx = (a.x + b.x) / 2 - c.x;
    const my = (a.y + b.y) / 2 - c.y;
    if (nx * mx + ny * my < 0) {
      nx = -nx;
      ny = -ny;
    }
    out.push({ x: nx, y: ny });
  }
  return out;
}

/**
 * ADR-449 Slice 9 — **directional** dilation: μεγαλώνει το πολύγωνο ΜΟΝΟ κατά τον άξονα
 * `axis` (±), αφήνοντας την **εγκάρσια** διάσταση ΑΜΕΤΑΒΛΗΤΗ. Κάθε κορυφή σπρώχνεται
 * `±d·axis` ανάλογα με την προβολή της ως προς το centroid → οι ακμές «άκρα» (⊥ axis)
 * μετατοπίζονται έξω, οι ακμές «πλευρές» (∥ axis) μένουν στη θέση τους.
 *
 * Χρήση (ADR-449): cross-structural obstacle ενός **δοκαριού** που καρφώνεται flush στην
 * παρειά κολόνας. Το isotropic `dilatePolygonOutward` γεφύρωνε μεν το flush seam αλλά
 * μεγάλωνε ΚΑΙ εγκάρσια → «έτρωγε» το remnant σοβά της κολόνας ΚΑΘΕ πλευρά → ορατό κενό
 * στη γωνιακή συμβολή. Η directional εκδοχή γεφυρώνει το flush **μόνο κατά τον άξονα του
 * δοκαριού** (το άκρο του δοκαριού περνά την παρειά) ΧΩΡΙΣ εγκάρσια συρρίκνωση → το remnant
 * φτάνει ΑΚΡΙΒΩΣ την παρειά του δοκαριού → μηδέν κενό. `axis` = μοναδιαίο διάνυσμα.
 */
export function dilatePolygonAlongAxis(poly: readonly Pt2[], axis: Pt2, d: number): Pt2[] {
  const n = poly.length;
  if (n < 3 || d <= 0) return projectVerticesTo2D(poly);
  const c = centroidOf(poly);
  return poly.map((p) => {
    const proj = (p.x - c.x) * axis.x + (p.y - c.y) * axis.y;
    const s = proj > EPS ? d : proj < -EPS ? -d : 0;
    return { x: p.x + s * axis.x, y: p.y + s * axis.y };
  });
}

/**
 * Επιστρέφει νέο πολύγωνο μεγεθυμένο προς τα έξω κατά `d`. `d ≤ 0` ή <3 κορυφές →
 * επιστρέφει αντίγραφο αμετάβλητο.
 */
export function dilatePolygonOutward(poly: readonly Pt2[], d: number): Pt2[] {
  const n = poly.length;
  if (n < 3 || d <= 0) return projectVerticesTo2D(poly);
  const c = centroidOf(poly);
  const nrm = outwardNormals(poly, c);
  const out: Pt2[] = [];
  for (let k = 0; k < n; k++) {
    const v = poly[k];
    const n1 = nrm[(k - 1 + n) % n]; // ακμή που τελειώνει στο v
    const n2 = nrm[k]; // ακμή που ξεκινά από το v
    const denom = 1 + (n1.x * n2.x + n1.y * n2.y);
    let mx: number;
    let my: number;
    if (denom < EPS) {
      mx = d * n2.x;
      my = d * n2.y; // ~180° reversal → απλό push
    } else {
      mx = (d * (n1.x + n2.x)) / denom;
      my = (d * (n1.y + n2.y)) / denom;
      const mag = Math.hypot(mx, my);
      if (mag > MITER_LIMIT * d) {
        const s = (MITER_LIMIT * d) / mag;
        mx *= s;
        my *= s;
      }
    }
    out.push({ x: v.x + mx, y: v.y + my });
  }
  return out;
}
