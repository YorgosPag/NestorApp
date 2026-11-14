/**
 * ADR-941 Φ2β (Δ17 · Δ20) — **ποια απόληξη** είναι σχεδιασμένη σε ένα άκρο γραμμής διάστασης του PDF: ανάλυση μέσω
 * **σύνθεσης**. Για κάθε μπλοκ της βιβλιοθήκης (`ARROWHEAD_BLOCKS`) και κάθε μέγεθος που υπονοούν οι γραμμές γύρω από τη
 * μύτη, «σφραγίζουμε» το μπλοκ με τον ΙΔΙΟ τοποθετητή που γράφει το DXF (`placeArrowheadBlock`) και ρωτάμε: **υπάρχει κάθε
 * κομμάτι του στο PDF;** Νικά το μπλοκ που εξηγεί τις περισσότερες γραμμές. Καθαρό.
 *
 * 🔑 **Μία βιβλιοθήκη για ζωγραφική και αναγνώριση.** Νέο μπλοκ στη βιβλιοθήκη ⇒ αναγνωρίζεται χωρίς γραμμή κώδικα εδώ· και
 *   η διάσταση που γεννιέται ζωγραφίζει το **ίδιο** μπλοκ (`dimblk1/2`) — ό,τι είδες στο PDF, βλέπεις στη σκηνή.
 * 🔑 **Ο κανόνας κατεύθυνσης του renderer**, όχι δεύτερος: τα μπλοκ με οδηγό (`dimLineInset`, «Τέκτων Βέλος 2») δείχνουν
 *   **προς τα μέσα** (`resolveLeaderArrowDir`).
 * 🔑 **Επίπεδο Y-πάνω.** Τα px της σελίδας έχουν Y κάτω· η σφράγιση γίνεται σε `(x, −y)`, ώστε τα ασύμμετρα μπλοκ (λοξή
 *   παύλα) να μην βγαίνουν κατοπτρικά.
 * 🔑 **Πλήρης ταύτιση ή τίποτα.** Κάθε πρωτογενές πρέπει να καλύπτεται (`MIN_COVERAGE`)· μερική ομοιότητα δεν είναι απόληξη.
 *
 * @module subapps/dxf-viewer/systems/pdf-vector-import/pdf-vector-arrowheads
 */

import type { Point2D } from '../../rendering/types/Types';
import type { PdfVectorPolyline, PxPoint } from '../../pdf-background/services/pdf-vector-content';
import { getArrowheadBlock, listArrowheadBlockNames } from '../dimensions/dim-arrowhead-blocks';
import { placeArrowheadBlock, type DimBlockPrimitive } from '../dimensions/dim-block-primitives';
import { resolveLeaderArrowDir } from '../../rendering/entities/dimension/dim-leader-arrow';
import { PDF_VECTOR_DIMENSION_GRAPHICS_LIMITS as LIMITS } from '../../config/tolerance-config';
import { coverageOf, distance, liesWithin, type PdfSegment, type SegmentGrid } from './pdf-vector-segments';

/** Μια αναγνωρισμένη απόληξη. */
export interface PdfArrowhead {
  readonly blockName: string;
  readonly apex: PxPoint;
  readonly sizePx: number;
  /** Τα τμήματα (`PdfSegment.id`) που εξηγεί το μπλοκ. */
  readonly segmentIds: readonly number[];
  /** Το μήκος του PDF που εξήγησε: το κριτήριο εξειδίκευσης (το «Τέκτων Βέλος 2» νικά το σκέτο τρίγωνο). */
  readonly explained: number;
}

/** Ό,τι χρειάζεται η αναγνώριση από τη σελίδα. */
export interface ArrowheadScene {
  readonly grid: SegmentGrid;
  readonly fills: readonly PdfVectorPolyline[];
  readonly polylines: readonly PdfVectorPolyline[];
}

interface Candidate {
  readonly blockName: string;
  readonly sizePx: number;
  readonly primitives: number;
  readonly segmentIds: readonly number[];
  readonly explained: number;
}

const toPlane = (p: PxPoint): Point2D => ({ x: p[0], y: -p[1] });
const fromPlane = (p: Point2D): PxPoint => [p.x, -p.y];

/** Οι μη μηδενικές αποστάσεις από τη μύτη των σημείων ενός μπλοκ (σε μονάδες μεγέθους): ό,τι μπορεί να «μετρηθεί» στο PDF. */
function unitRadii(blockName: string): number[] {
  const radii = getArrowheadBlock(blockName).geometry.flatMap((g) => {
    if (g.kind === 'line') return [Math.hypot(...g.from), Math.hypot(...g.to)];
    if (g.kind === 'triangle') return [g.v1, g.v2, g.v3].map((v) => Math.hypot(...v));
    const c = Math.hypot(...g.center);
    return [c + g.radius, Math.abs(c - g.radius)];
  });
  return [...new Set(radii.filter((r) => r > 1e-9).map((r) => +r.toFixed(9)))];
}

/** Τα μεγέθη που υπονοούν οι αποστάσεις `distances` για το μπλοκ, χωρίς σχεδόν-διπλότυπα (1%). */
function candidateSizes(blockName: string, distances: readonly number[], reach: number): number[] {
  const sizes = unitRadii(blockName).flatMap((r) => distances.map((d) => d / r)).filter((s) => s > 0 && s <= reach);
  const bins = new Map<number, number>();
  for (const s of sizes) bins.set(Math.round(Math.log(s) / Math.log1p(0.01)), s);
  return [...bins.values()];
}

/** Ένα γέμισμα που ταυτίζεται με το τρίγωνο `points` (κάθε κορυφή του έχει ζευγάρι, και αντίστροφα). */
function matchesFill(points: readonly PxPoint[], fill: PdfVectorPolyline, tol: number): boolean {
  const near = (p: PxPoint, set: readonly PxPoint[]): boolean => set.some((q) => distance(p, q) <= tol);
  return points.every((p) => near(p, fill.points)) && fill.points.every((p) => near(p, points));
}

/** Μια κλειστή πολυγραμμή/γέμισμα που είναι ο κύκλος `(centre, radius)`. */
function matchesCircle(centre: PxPoint, radius: number, poly: PdfVectorPolyline, tol: number): boolean {
  return poly.closed && poly.points.length >= 6 && poly.points.every((p) => Math.abs(distance(p, centre) - radius) <= tol);
}

/** Υπάρχει το πρωτογενές στο PDF; */
function primitivePresent(prim: DimBlockPrimitive, local: readonly PdfSegment[], scene: ArrowheadScene, tol: number): boolean {
  if (prim.kind === 'line') {
    const [a, b] = [fromPlane(prim.a), fromPlane(prim.b)];
    return distance(a, b) <= tol || coverageOf(a, b, local, tol) >= LIMITS.MIN_COVERAGE;
  }
  if (prim.kind === 'fill') return scene.fills.some((f) => matchesFill(prim.points.map(fromPlane), f, tol));
  if (prim.kind === 'circle') {
    const centre = fromPlane(prim.center);
    const polys = [...scene.fills, ...new Set(local.map((s) => scene.polylines[s.polylineIndex]))];
    return polys.some((p) => matchesCircle(centre, prim.radius, p, tol));
  }
  return false;
}

/** Τα τμήματα που κάθονται ολόκληρα πάνω σε κάποιο πρωτογενές (γραμμή, ή κύκλος ως ολόκληρη πολυγραμμή). */
function claimedBy(prims: readonly DimBlockPrimitive[], local: readonly PdfSegment[], scene: ArrowheadScene, tol: number): PdfSegment[] {
  return local.filter((s) => prims.some((prim) => {
    if (prim.kind === 'line') return liesWithin(s, fromPlane(prim.a), fromPlane(prim.b), tol);
    if (prim.kind === 'circle') return matchesCircle(fromPlane(prim.center), prim.radius, scene.polylines[s.polylineIndex], tol);
    return false;
  }));
}

/** Το περίγραμμα των γεμάτων πρωτογενών που βρέθηκαν ως γεμίσματα (ένα γεμάτο βέλος δεν έχει γραμμές να «εξηγήσει»). */
function filledExplained(prims: readonly DimBlockPrimitive[], scene: ArrowheadScene, tol: number): number {
  let sum = 0;
  for (const prim of prims) {
    if (prim.kind === 'fill') {
      const pts = prim.points.map(fromPlane);
      sum += pts.reduce((acc, p, i) => acc + distance(p, pts[(i + 1) % pts.length]), 0);
    } else if (prim.kind === 'circle' && scene.fills.some((f) => matchesCircle(fromPlane(prim.center), prim.radius, f, tol))) {
      sum += 2 * Math.PI * prim.radius;
    }
  }
  return sum;
}

/** Η σφράγιση του μπλοκ στη μύτη, ως υποψήφιο — ή `null` όταν κάποιο κομμάτι του λείπει από το PDF. */
function stamp(
  blockName: string, apex: PxPoint, outward: PxPoint, sizePx: number, local: readonly PdfSegment[], scene: ArrowheadScene,
): Candidate | null {
  const outwardPlane = toPlane(outward);
  const hasLeader = (getArrowheadBlock(blockName).dimLineInset ?? 0) > 0;
  const direction = resolveLeaderArrowDir(hasLeader, outwardPlane, outwardPlane);
  const tol = LIMITS.SHAPE_TOL_OF_SIZE * sizePx;
  let best: Candidate | null = null;
  for (const side of [1, 2] as const) {
    const prims = placeArrowheadBlock(blockName, toPlane(apex), direction, sizePx, side);
    if (prims.length === 0 || !prims.every((p) => primitivePresent(p, local, scene, tol))) continue;
    const claimed = claimedBy(prims, local, scene, tol);
    const explained = claimed.reduce((sum, s) => sum + s.length, 0) + filledExplained(prims, scene, tol);
    if (!best || explained > best.explained) {
      best = { blockName, sizePx, primitives: prims.length, segmentIds: claimed.map((s) => s.id), explained };
    }
  }
  return best;
}

/** Ποιο υποψήφιο εξηγεί περισσότερα· ισοπαλία ⇒ το απλούστερο (λιγότερα πρωτογενή)· μετά η σειρά της βιβλιοθήκης. */
function better(a: Candidate | null, b: Candidate): Candidate {
  if (!a) return b;
  const eps = 1e-6 * Math.max(a.explained, b.explained, 1);
  if (b.explained > a.explained + eps) return b;
  if (Math.abs(b.explained - a.explained) <= eps && b.primitives < a.primitives) return b;
  return a;
}

/**
 * Η απόληξη στη μύτη `apex`, με `outward` = η μοναδιαία κατεύθυνση **έξω** από τη γραμμή διάστασης (η σύμβαση του
 * `arrowDirection` του builder), ή `null` όταν κανένα μπλοκ της βιβλιοθήκης δεν υπάρχει ολόκληρο εκεί.
 */
export function arrowheadAt(apex: PxPoint, outward: PxPoint, scene: ArrowheadScene, em: number): PdfArrowhead | null {
  const reach = LIMITS.ARROW_REACH_EM * em;
  const local = scene.grid.near(apex, reach);
  const nearScene: ArrowheadScene = { ...scene, fills: scene.fills.filter((f) => f.points.some((p) => distance(apex, p) <= reach)) };
  const distances = [...local.flatMap((s) => [s.a, s.b]), ...nearScene.fills.flatMap((f) => f.points)]
    .map((p) => distance(apex, p)).filter((d) => d > 0 && d <= reach);
  if (distances.length === 0) return null;
  let best: Candidate | null = null;
  for (const blockName of listArrowheadBlockNames()) {
    for (const sizePx of candidateSizes(blockName, distances, reach)) {
      const candidate = stamp(blockName, apex, outward, sizePx, local, nearScene);
      if (candidate) best = better(best, candidate);
    }
  }
  return best && best.explained > 0
    ? { blockName: best.blockName, apex, sizePx: best.sizePx, segmentIds: best.segmentIds, explained: best.explained }
    : null;
}
