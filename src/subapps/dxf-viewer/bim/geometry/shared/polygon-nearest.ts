/**
 * polygon-nearest — SSoT για την **πιο σύντομη διαδρομή (nearest segment)** ανάμεσα σε
 * σχήματα κάτοψης (2D πολύγωνα): σημείο→περίγραμμα και περίγραμμα→περίγραμμα.
 *
 * Γιατί SSoT: το idiom «πλησιέστερο σημείο ενός κλειστού outline» υπήρχε ΜΟΝΟ ως **private**
 * αντίγραφο μέσα στο `bim/framing/beam-span-snap.ts` (`closestPointOnOutline`) — κανένα
 * exported helper δεν έδινε το **ζεύγος πλησιέστερων σημείων δύο πολυγώνων** (τις αντικριστές
 * «παρειές»). Το χρειάζεται η εντολή «Δοκάρι ανάμεσα σε μέλη» (ADR-569) και μελλοντικά μπορεί
 * να το υιοθετήσει και το `beam-span-snap` (πρβλ. Boy-Scout N.0.2). Χτισμένο πάνω στο ΚΟΙΝΟ
 * `getNearestPointOnLine` (rendering/entities/shared/geometry-utils) — μηδέν αντιγραφή
 * point-to-segment math.
 *
 * Pure — zero React/DOM/store.
 *
 * @see bim/framing/beam-span-snap.ts — cursor-driven auto-span (private closestPointOnOutline)
 * @see rendering/entities/shared/geometry-utils.ts — getNearestPointOnLine (SSoT point→segment)
 * @see docs/centralized-systems/reference/adrs/ADR-569-beam-between-members.md
 */

import type { Point2D } from '../../../rendering/types/Types';
import { getNearestPointOnLine } from '../../../rendering/entities/shared/geometry-utils';
import { polygon2DCentroid } from './polygon-utils';

const EPS = 1e-6;

/** Ζεύγος πλησιέστερων σημείων + η μεταξύ τους απόσταση. */
export interface NearestPair {
  /** Σημείο πάνω στο πρώτο σχήμα (παρειά που «κοιτάζει» το δεύτερο). */
  readonly a: Point2D;
  /** Σημείο πάνω στο δεύτερο σχήμα (παρειά που «κοιτάζει» το πρώτο). */
  readonly b: Point2D;
  /** Ευκλείδεια απόσταση `|a-b|` (world/scene units). */
  readonly dist: number;
}

function sqDist(p: Readonly<Point2D>, q: Readonly<Point2D>): number {
  const dx = p.x - q.x;
  const dy = p.y - q.y;
  return dx * dx + dy * dy;
}

/** Πλησιέστερο σημείο του περιγράμματος + η **ακμή** (μοναδιαία διεύθυνση + άκρα) πάνω στην οποία πέφτει. */
export interface OutlineEdgeHit {
  /** Πλησιέστερο σημείο πάνω στο κλειστό περίγραμμα (clamped στα άκρα της ακμής). */
  readonly point: Point2D;
  /** Μοναδιαία διεύθυνση της ακμής πάνω στην οποία πέφτει το `point` (unit dir). */
  readonly edge: Point2D;
  /** Τα δύο άκρα της ακμής (για justified alignment κατά μήκος της παρειάς). */
  readonly seg: readonly [Point2D, Point2D];
  /** Ευκλείδεια απόσταση `|point-target|`. */
  readonly dist: number;
}

/**
 * Όπως `closestPointOnPolygonOutline`, αλλά επιστρέφει ΚΑΙ τη **διεύθυνση της ακμής** (facing-παρειά)
 * πάνω στην οποία πέφτει το πλησιέστερο σημείο — για framing που πρέπει να **ευθυγραμμιστεί στην παρειά**
 * (ADR-569: ο άξονας του δοκαριού = **κάθετος** της facing-παρειάς → ποτέ λοξός, ακόμη κι όταν τα κέντρα
 * των μελών διαφέρουν σε Y). Core edge-walk μέσω του ΚΟΙΝΟΥ `getNearestPointOnLine` (clamped). `< 2`
 * κορυφές → `null`.
 */
export function closestEdgeOnPolygonOutline(
  outline: readonly Point2D[],
  target: Readonly<Point2D>,
): OutlineEdgeHit | null {
  const n = outline.length;
  if (n < 2) return null;
  let bestPoint: Point2D = outline[0];
  let bestEdge: Point2D = { x: 1, y: 0 };
  let bestSeg: readonly [Point2D, Point2D] = [outline[0], outline[0]];
  let bestD = Infinity;
  for (let i = 0; i < n; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % n];
    const q = getNearestPointOnLine(target, a, b, true);
    const d = sqDist(q, target);
    if (d < bestD) {
      bestD = d;
      bestPoint = q;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      bestEdge = len > EPS ? { x: (b.x - a.x) / len, y: (b.y - a.y) / len } : { x: 1, y: 0 };
      bestSeg = [a, b];
    }
  }
  return { point: { x: bestPoint.x, y: bestPoint.y }, edge: bestEdge, seg: bestSeg, dist: Math.sqrt(bestD) };
}

/**
 * Πλησιέστερο σημείο του **κλειστού περιγράμματος** ενός πολυγώνου στο `target` (η παρειά που
 * «κοιτάζει» το target). Delegate στο `closestEdgeOnPolygonOutline` (ΕΝΑ edge-walk SSoT)· `< 2`
 * κορυφές → επιστρέφει την πρώτη (ή το target αν κενό).
 */
export function closestPointOnPolygonOutline(
  outline: readonly Point2D[],
  target: Readonly<Point2D>,
): Point2D {
  const hit = closestEdgeOnPolygonOutline(outline, target);
  if (hit) return hit.point;
  return outline.length === 0 ? { x: target.x, y: target.y } : { x: outline[0].x, y: outline[0].y };
}

/**
 * **Πιο σύντομη διαδρομή** ανάμεσα σε δύο κλειστά πολύγωνα κάτοψης: το ζεύγος πλησιέστερων
 * σημείων στα περιγράμματά τους (τις αντικριστές παρειές). Για κυρτά πολύγωνα το ελάχιστο
 * περιλαμβάνει πάντα ≥1 κορυφή, οπότε αρκεί να ελεγχθούν οι κορυφές του καθενός ως προς το
 * περίγραμμα του άλλου (O(nA·nB), αμελητέο για footprints 4-12 κορυφών)· για κοίλα (L/T/U)
 * μέλη δίνει το σωστό «feature-to-feature» ελάχιστο κατά τα συνήθη.
 *
 * Επιστρέφει `null` όταν τα πολύγωνα είναι εκφυλισμένα (`< 3` κορυφές) ή **εφάπτονται/επικαλύπτονται**
 * (`dist < EPS`) — δηλαδή δεν υπάρχει καθαρό κενό για να γεφυρωθεί.
 */
export function shortestSegmentBetweenPolygons(
  polyA: readonly Point2D[],
  polyB: readonly Point2D[],
): NearestPair | null {
  if (polyA.length < 3 || polyB.length < 3) return null;
  let best: NearestPair | null = null;
  let bestSq = Infinity;
  // Κορυφές του A → περίγραμμα του B.
  for (const va of polyA) {
    const qb = closestPointOnPolygonOutline(polyB, va);
    const d = sqDist(va, qb);
    if (d < bestSq) {
      bestSq = d;
      best = { a: { x: va.x, y: va.y }, b: qb, dist: Math.sqrt(d) };
    }
  }
  // Κορυφές του B → περίγραμμα του A.
  for (const vb of polyB) {
    const qa = closestPointOnPolygonOutline(polyA, vb);
    const d = sqDist(vb, qa);
    if (d < bestSq) {
      bestSq = d;
      best = { a: qa, b: { x: vb.x, y: vb.y }, dist: Math.sqrt(d) };
    }
  }
  if (!best || best.dist < EPS) return null;
  return best;
}

/** Πλησιέστερα σημεία δύο πολυγώνων + η **facing-ακμή** (η παρειά του «πιο κοντινού σκέλους»). */
export interface FacingEdgePair {
  /** Το ζεύγος αντικριστών σημείων (τις παρειές που κοιτάζουν το ένα το άλλο). */
  readonly nearest: NearestPair;
  /** Μοναδιαία διεύθυνση της facing-ακμής — η **κάθετός** της = διεύθυνση δοκαριού (ADR-569). */
  readonly edge: Point2D;
  /** Τα άκρα της facing-ακμής (κατά μήκος της παρειάς). */
  readonly seg: readonly [Point2D, Point2D];
  /**
   * Τα άκρα της facing-παρειάς του **A** (το «σκέλος» του A που κοιτάζει το B). Χρησιμεύει ως το
   * **cross-section** στη θέση σύνδεσης: η εγκάρσια προβολή του δίνει το **ύψος της παρειάς εκεί** —
   * για Τ/Γ μέλη ΜΟΝΟ το αντικριστό σκέλος (βραχίονας), όχι όλο το footprint (ADR-569 §Τ-mirror).
   */
  readonly segA: readonly [Point2D, Point2D];
  /** Τα άκρα της facing-παρειάς του **B** (αντίστοιχο cross-section του B, βλ. `segA`). */
  readonly segB: readonly [Point2D, Point2D];
}

/**
 * **Facing-ακμή** ανάμεσα σε δύο κλειστά πολύγωνα κάτοψης: το ζεύγος αντικριστών σημείων ΜΑΖΙ με τη
 * **διεύθυνση της ακμής** πάνω στην οποία πέφτει η πλησιέστερη παρειά (το «πιο κοντινό σκέλος»). Το
 * χρειάζεται η εντολή «Δοκάρι ανάμεσα σε μέλη» (ADR-569, Giorgio 2026-07-03: «ακολουθεί ΠΑΝΤΑ τις
 * παρειές του πιο κοντινού σκέλους»): η **κάθετος** αυτής της ακμής ορίζει τη διεύθυνση του δοκαριού,
 * ώστε να μένει **ορθογώνιο στην παρειά** (ποτέ λοξό — όπως θα έγερνε ένας centroid→centroid άξονας
 * όταν τα κέντρα διαφέρουν σε Y).
 *
 * **Centroid-probing + 2-step refinement** (ίδιο πρότυπο με το δοκιμασμένο `pairFrame` του
 * `beam-span-snap`): `fA = closest(A, centroid B)` → `fB = closest(B, fA)` → refine `fA = closest(A, fB)`.
 * Έτσι η πλησιέστερη παρειά πέφτει στο **εσωτερικό ακμής** (όχι σε κορυφή) για ευθυγραμμισμένα/κοίλα
 * μέλη — vertex-probing θα κατέληγε σε γωνία και θα διάλεγε λάθος (κάθετη) ακμή. Η επιστρεφόμενη `edge`
 * = η facing-ακμή του μέλους της οποίας η **κάθετος** ευθυγραμμίζεται καλύτερα με τη διεύθυνση A→B (πιο
 * face-perpendicular). `null` για εκφυλισμένα (`< 3` κορυφές) ή **εφαπτόμενα/επικαλυπτόμενα** (`dist < EPS`).
 */
export function closestFacingEdgeBetweenPolygons(
  polyA: readonly Point2D[],
  polyB: readonly Point2D[],
): FacingEdgePair | null {
  if (polyA.length < 3 || polyB.length < 3) return null;
  const cA = polygon2DCentroid(polyA);
  const cB = polygon2DCentroid(polyB);
  // Centroid-probing + refinement → οι facing-παρειές πέφτουν σε εσωτερικό ακμής (όχι κορυφή).
  const fA0 = closestEdgeOnPolygonOutline(polyA, cB);
  if (!fA0) return null;
  const hB = closestEdgeOnPolygonOutline(polyB, fA0.point);
  if (!hB) return null;
  const hA = closestEdgeOnPolygonOutline(polyA, hB.point);
  if (!hA) return null;
  const dist = Math.hypot(hA.point.x - hB.point.x, hA.point.y - hB.point.y);
  if (dist < EPS) return null; // εφαπτόμενα / επικαλυπτόμενα → κανένα καθαρό κενό
  const nearest: NearestPair = { a: hA.point, b: hB.point, dist };
  // Επιλογή facing-ακμής: αυτή της οποίας η κάθετος ευθυγραμμίζεται καλύτερα με τη φορά A→B (face-perpendicular).
  const abx = cB.x - cA.x;
  const aby = cB.y - cA.y;
  const scoreA = Math.abs(-hA.edge.y * abx + hA.edge.x * aby); // |normal(edgeA) · (A→B)|
  const scoreB = Math.abs(-hB.edge.y * abx + hB.edge.x * aby);
  const pick = scoreA >= scoreB ? hA : hB;
  return { nearest, edge: pick.edge, seg: pick.seg, segA: hA.seg, segB: hB.seg };
}
