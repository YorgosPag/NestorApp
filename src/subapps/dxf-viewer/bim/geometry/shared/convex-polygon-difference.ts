/**
 * convex-polygon-difference.ts — robust, **clipper-free** `subject ∖ convexHole`.
 * ADR-404 Phase 4.3 robustness fix (SSoT).
 *
 * Η `polygon-clipping` (μέσω `safe-polygon-boolean.safeDifference`) είναι εύθραυστη
 * σε **σχεδόν-εκφυλισμένες** διαμορφώσεις (π.χ. δοκάρι που μόλις-μόλις **γεφυρώνει**
 * λεπτό τοίχο στο ύψος προσάρτησης): ο sweep-line πετά «Unable to complete output
 * ring» → graceful fallback κενό → διαφθορά της tilt-loft τοπολογίας (κενά + στοιχεία
 * που μπαίνουν μέσα στο δοκάρι).
 *
 * Όταν το **αφαιρούμενο** πολύγωνο (η «τρύπα») είναι **κυρτό** (το αποτύπωμα δοκαριού
 * είναι ορθογώνιο → κυρτό), η διαφορά υπολογίζεται **αναλυτικά** χωρίς boolean lib:
 *
 *   convex `H = ⋂ᵢ Lᵢ`  (Lᵢ = εσωτερικό ημιεπίπεδο της ακμής i, CCW)
 *   ⟹  `S ∖ H = S ∩ (⋃ᵢ L̄ᵢ) = ⋃ᵢ (S ∩ L̄ᵢ)`
 *
 * **Peel** (κάθε κομμάτι αποκλείεται από την «πρώτη» ακμή που το αφήνει έξω):
 *   pieceᵢ = S ∩ L₁ ∩ … ∩ Lᵢ₋₁ ∩ L̄ᵢ          (ξένα μεταξύ τους)
 *   remaining μετά από όλες τις ακμές = S ∩ H  (η τρύπα — απορρίπτεται)
 *
 * Κάθε βήμα = Sutherland–Hodgman κοπή σε **ένα** ημιεπίπεδο → ποτέ δεν αποτυγχάνει,
 * μηδέν ring-completion failures, καθαρά convex κομμάτια (ιδανικά για prism/loft).
 * Τα κομμάτια κανονικοποιούνται σε **CCW** (ίδια σύμβαση με `ringToPts`).
 *
 * **Προϋπόθεση:** η τρύπα κυρτή. Μη-κυρτή (π.χ. L-shaped slab) → ο caller πέφτει πίσω
 * στο `safeDifference`. Το `subject` μπορεί να είναι οποιοδήποτε απλό πολύγωνο.
 *
 * @see bim/geometry/shared/safe-polygon-boolean.ts — το fragile boolean (fallback)
 * @see bim-3d/converters/wall-top-clip.ts — ο καταναλωτής (tilt loft)
 * @see docs/centralized-systems/reference/adrs/ADR-404-3d-bim-element-tilt.md §Phase 4.3
 */

import { projectPointTo2D } from './polygon-utils';

export interface Pt2 {
  readonly x: number;
  readonly y: number;
}

/** Όριο εμβαδού (units²) κάτω από το οποίο ένα κομμάτι είναι sliver → απορρίπτεται. */
const AREA_EPS = 1e-9;
/** Ανοχή «πάνω στη γραμμή» — κανονικοποιημένη ως προς το cross product. */
const ON_LINE_EPS = 1e-9;

/** Signed εμβαδόν (shoelace): θετικό ⇒ CCW στο plan (x,y). */
function signedArea(pts: readonly Pt2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/**
 * Είναι το **κυρτό** δακτύλιος; (όλα τα cross products ίδιου προσήμου, αγνοώντας
 * τα ~μηδενικά). Χρησιμοποιείται από τον caller για να αποφασίσει αν επιτρέπεται
 * το analytic path (αλλιώς boolean fallback).
 */
export function isConvexRing(pts: readonly Pt2[]): boolean {
  if (pts.length < 3) return false;
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const c = pts[(i + 2) % pts.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < ON_LINE_EPS) continue; // collinear → αγνόησε
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** Καθαρίζει συνεχόμενες διπλές κορυφές + closing vertex (zero-length ακμές). */
function dedupe(pts: readonly Pt2[]): Pt2[] {
  const out: Pt2[] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.x - p.x) < 1e-12 && Math.abs(prev.y - p.y) < 1e-12) continue;
    out.push(projectPointTo2D(p));
  }
  if (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.abs(a.x - b.x) < 1e-12 && Math.abs(a.y - b.y) < 1e-12) out.pop();
  }
  return out;
}

/**
 * Sutherland–Hodgman κοπή του `poly` στο ημιεπίπεδο **δεξιά** της κατευθυνόμενης
 * ευθείας `a→b` (cross ≤ 0). Επιστρέφει το (απλό) κομμάτι· κενό αν τίποτα δεξιά.
 * Ποτέ δεν αποτυγχάνει (καθαρή γραμμική γεωμετρία, χωρίς ring completion).
 */
function clipRightOfLine(poly: readonly Pt2[], a: Pt2, b: Pt2): Pt2[] {
  if (poly.length < 3) return [];
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const norm = Math.hypot(ex, ey) || 1;
  // side > 0 ⇒ αριστερά (μέσα στην κυρτή τρύπα)· side < 0 ⇒ δεξιά (έξω → κρατάμε).
  const side = (p: Pt2): number => ((ex * (p.y - a.y) - ey * (p.x - a.x)) / norm);
  const out: Pt2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const nxt = poly[(i + 1) % poly.length];
    const sCur = side(cur);
    const sNxt = side(nxt);
    const curIn = sCur <= ON_LINE_EPS; // δεξιά ή πάνω στη γραμμή
    const nxtIn = sNxt <= ON_LINE_EPS;
    if (curIn) out.push(cur);
    if (curIn !== nxtIn) {
      const t = sCur / (sCur - sNxt); // τομή με τη γραμμή (side === 0)
      out.push({ x: cur.x + t * (nxt.x - cur.x), y: cur.y + t * (nxt.y - cur.y) });
    }
  }
  return out;
}

/**
 * `subject ∖ convexHole` ως **ξένα convex κομμάτια** (CCW, sliver-filtered), χωρίς
 * boolean lib. Η `convexHole` **πρέπει** να είναι κυρτή (έλεγξε με {@link isConvexRing}).
 * Επιστρέφει κενό όταν το `subject` καλύπτεται πλήρως από την τρύπα.
 */
export function convexPolygonDifference(
  subject: readonly Pt2[],
  convexHole: readonly Pt2[],
): Pt2[][] {
  const subj = dedupe(subject);
  const hole = dedupe(convexHole);
  if (subj.length < 3) return [];
  if (hole.length < 3) return [normalizeCcw(subj)].filter((p): p is Pt2[] => p !== null);

  // Κανονικοποίηση τρύπας σε CCW ώστε «μέσα» = αριστερά κάθε κατευθυνόμενης ακμής.
  const holeCcw = signedArea(hole) < 0 ? [...hole].reverse() : hole;

  const pieces: Pt2[][] = [];
  let remaining: Pt2[] = subj;
  for (let i = 0; i < holeCcw.length; i++) {
    const a = holeCcw[i];
    const b = holeCcw[(i + 1) % holeCcw.length];
    if (Math.abs(a.x - b.x) < 1e-12 && Math.abs(a.y - b.y) < 1e-12) continue; // degenerate edge
    // Κομμάτι αυτής της ακμής = ό,τι από το remaining πέφτει ΔΕΞΙΑ (έξω από την τρύπα).
    const piece = normalizeCcw(clipRightOfLine(remaining, a, b));
    if (piece) pieces.push(piece);
    // Το υπόλοιπο (ΑΡΙΣΤΕΡΑ της ακμής) συνεχίζει· τελικό remaining = subject ∩ hole (τρύπα).
    remaining = clipLeftOfLine(remaining, a, b);
    if (remaining.length < 3) break;
  }
  return pieces;
}

/** Sutherland–Hodgman κοπή **αριστερά** της `a→b` (το συμπληρωματικό του right). */
function clipLeftOfLine(poly: readonly Pt2[], a: Pt2, b: Pt2): Pt2[] {
  // Αριστερά της a→b == δεξιά της b→a.
  return clipRightOfLine(poly, b, a);
}

/** dedupe + sliver filter + CCW· `null` αν εκφυλισμένο. */
function normalizeCcw(pts: readonly Pt2[]): Pt2[] | null {
  const d = dedupe(pts);
  if (d.length < 3) return null;
  if (Math.abs(signedArea(d)) < AREA_EPS) return null;
  if (signedArea(d) < 0) d.reverse();
  return d;
}
