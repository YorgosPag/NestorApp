/**
 * ADR-449 PART B Slice B — Blanket override attribution (per-face υλικό/χρώμα στην
 * ΕΝΙΑΙΑ σιλουέτα): pure SSoT.
 *
 * Πρόβλημα: το merged silhouette (`computeStructuralSilhouetteBands`) ενώνει τα cores
 * σε ΕΝΑ outline και τρέχει τον resolver με **ΕΝΑ** default spec → τα per-element
 * `spec.faceOverrides` (Revit «Paint») ΔΕΝ φτάνουν στα blanket segments. Χειρότερα:
 * όταν δύο συνευθειακά στοιχεία με ΔΙΑΦΟΡΕΤΙΚΟ override συναντιούνται, το union έχει
 * ΑΦΑΙΡΕΣΕΙ την κοινή κορυφή (PART A το επιδιώκει) → ΕΝΑ blanket segment καλύπτει ΚΑΙ
 * τα δύο χωρίς ενδιάμεση κορυφή → δεν αρκεί stamp, χρειάζεται **split** στο σύνορο.
 *
 * Λύση: για κάθε blanket segment, βρες τις collinear+overlapping override-edges (σε
 * canvas units, ίδιος χώρος με τα members), **σπάσε** το segment στα σύνορα (project
 * endpoints σε t∈[0,1], partition), και **stamp** `materialId`/`colorOverride`/`thickness`
 * ανά κομμάτι· gap = default (byte-for-byte). Junction/square flags μένουν ΜΟΝΟ στα
 * πραγματικά άκρα — τα ενδιάμεσα split points είναι «καθαρά». Το output το ξαναπερνά ο
 * PART A `mergeCollinearFinishSegments` → same-material/color κομμάτια ξαναενώνονται
 * (μηδέν regression), διαφορετικό υλικό/χρώμα μένει σπασμένο = καθαρό σύνορο.
 *
 * **BOQ αμετάβλητο ανά segment**: `lengthM` κάθε κομματιού = `seg.lengthM × frac`
 * (Σ = ταυτότητα). Το group-by-material το ξαναδιαβάζει μετά (per-face materialId).
 *
 * Pure: μηδέν globals/React/THREE.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §PART B
 */

import type { FinishFaceSegment, FinishFaceOverride } from './structural-finish-types';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
import { segmentAxis, type SegAxis } from './finish-segment-geometry';

/**
 * Μια ακμή footprint στοιχείου που φέρει per-face override (canvas units — ΙΔΙΟΣ χώρος
 * με τα silhouette members). Ο caller τη χτίζει από `spec.faceOverrides` μέσω
 * {@link finishFaceRef}: για κάθε ακμή a→b του footprint με override → `{a, b, override}`.
 */
export interface FinishOverrideEdge {
  readonly a: Pt2;
  readonly b: Pt2;
  readonly override: FinishFaceOverride;
}

/** Default ανοχή collinearity (canvas units). Πολύ κάτω από κάθε πάχος σοβά (≥15mm) → δεν ταιριάζει ποτέ απέναντι παρειά. */
const DEFAULT_TOL = 1e-3;
/** Ελάχιστο t-εύρος (0..1) ώστε ένα κομμάτι/interval να μη θεωρηθεί εκφυλισμένο. */
const T_EPS = 1e-9;

/** Απόσταση σημείου `p` από την **άπειρη ευθεία** που περνά από `a` με μοναδιαία διεύθυνση `u`. */
function perpDist(p: Pt2, a: Pt2, u: SegAxis): number {
  const wx = p.x - a.x;
  const wy = p.y - a.y;
  return Math.abs(wx * u.y - wy * u.x);
}

/** Παράμετρος t∈ℝ του `p` προβεβλημένου στο a→b (0 = a, 1 = b). */
function projectT(p: Pt2, a: Pt2, u: SegAxis): number {
  return ((p.x - a.x) * u.x + (p.y - a.y) * u.y) / u.len;
}

function lerp(a: Pt2, b: Pt2, t: number): Pt2 {
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

interface CoverInterval {
  readonly t0: number;
  readonly t1: number;
  readonly override: FinishFaceOverride;
}

/** Covering intervals μιας ακμής πάνω στο seg: collinear override-edges → [t0,t1] clamped στο [0,1]. */
function coverIntervals(seg: FinishFaceSegment, u: UnitAxis, edges: readonly FinishOverrideEdge[], tol: number): CoverInterval[] {
  // ADR-449 PART B Fix A — παραμετρική ανοχή = canvas tol / μήκος seg: σύνορο override που πέφτει
  // εντός αυτής από πραγματικό άκρο snap-άρει στο ΑΚΡΙΒΩΣ 0/1. Ρίζα: το override-edge χτίζεται από
  // τα ΑΝΕΠΕΞΕΡΓΑΣΤΑ element vertices, το blanket segment από τη WELDED union (drift ~quantum/2) →
  // χωρίς snap γεννιόνται εκφυλισμένα default slivers στα άκρα → ψευδο-γωνίες κοντά σε πραγματικές.
  const tSnap = tol / u.len;
  const out: CoverInterval[] = [];
  for (const e of edges) {
    // Collinear: ΚΑΙ τα δύο άκρα της override-edge πάνω στην ευθεία του seg.
    if (perpDist(e.a, seg.a, u) > tol || perpDist(e.b, seg.a, u) > tol) continue;
    const ta = projectT(e.a, seg.a, u);
    const tb = projectT(e.b, seg.a, u);
    let t0 = Math.max(0, Math.min(ta, tb));
    let t1 = Math.min(1, Math.max(ta, tb));
    if (t0 < tSnap) t0 = 0;
    if (t1 > 1 - tSnap) t1 = 1;
    if (t1 - t0 > T_EPS) out.push({ t0, t1, override: e.override });
  }
  return out;
}

/** Το override που καλύπτει το midpoint `mid` (first-wins σε τυχόν επικάλυψη). */
function overrideAt(mid: number, intervals: readonly CoverInterval[]): FinishFaceOverride | undefined {
  for (const iv of intervals) {
    if (iv.t0 - T_EPS <= mid && mid <= iv.t1 + T_EPS) return iv.override;
  }
  return undefined;
}

/** Ένα κομμάτι [t0,t1] του seg με εφαρμοσμένο (ή μη) override. Junction/square flags μόνο στα άκρα. */
function buildPiece(
  seg: FinishFaceSegment,
  t0: number,
  t1: number,
  override: FinishFaceOverride | undefined,
  isFirst: boolean,
  isLast: boolean,
): FinishFaceSegment {
  const a = isFirst ? seg.a : lerp(seg.a, seg.b, t0);
  const b = isLast ? seg.b : lerp(seg.a, seg.b, t1);
  const color = override?.colorOverride ?? seg.colorOverride;
  return {
    a,
    b,
    classification: seg.classification,
    materialId: override?.materialId ?? seg.materialId,
    thickness: override?.thickness ?? seg.thickness,
    lengthM: seg.lengthM * (t1 - t0),
    aJunction: isFirst ? seg.aJunction : false,
    bJunction: isLast ? seg.bJunction : false,
    aSquareEnd: isFirst ? seg.aSquareEnd : false,
    bSquareEnd: isLast ? seg.bSquareEnd : false,
    ...(color ? { colorOverride: color } : {}),
  };
}

/** Ένα blanket segment → κομμάτια σπασμένα στα σύνορα override (ή το ίδιο αν κανένα override). */
function attributeSegment(seg: FinishFaceSegment, edges: readonly FinishOverrideEdge[], tol: number): FinishFaceSegment[] {
  const u = segmentAxis(seg.a, seg.b);
  if (!u) return [seg];
  const intervals = coverIntervals(seg, u, edges, tol);
  if (intervals.length === 0) return [seg];

  const bounds = new Set<number>([0, 1]);
  for (const iv of intervals) {
    bounds.add(iv.t0);
    bounds.add(iv.t1);
  }
  const sorted = [...bounds].sort((p, q) => p - q);

  const pieces: FinishFaceSegment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const t0 = sorted[i];
    const t1 = sorted[i + 1];
    if (t1 - t0 <= T_EPS) continue;
    const override = overrideAt((t0 + t1) / 2, intervals);
    pieces.push(buildPiece(seg, t0, t1, override, t0 <= T_EPS, t1 >= 1 - T_EPS));
  }
  return pieces.length > 0 ? pieces : [seg];
}

/**
 * Εφαρμόζει τα per-face overrides στα blanket segments: για κάθε segment σπάει στα
 * σύνορα των collinear override-edges και stamp-άρει υλικό/χρώμα/πάχος. Το output το
 * ξαναπερνά ο PART A merge (same-material κομμάτια ξαναενώνονται). Κενές edges → μηδέν
 * αλλαγή (επιστρέφει τα ίδια segments, νέο array). `tol` = ανοχή collinearity (canvas
 * units) — default sub-mm, robust σε weld drift, πολύ κάτω από πάχος σοβά.
 */
export function applyFinishOverrideEdges(
  segments: readonly FinishFaceSegment[],
  edges: readonly FinishOverrideEdge[],
  tol: number = DEFAULT_TOL,
): FinishFaceSegment[] {
  if (edges.length === 0) return [...segments];
  const out: FinishFaceSegment[] = [];
  for (const seg of segments) out.push(...attributeSegment(seg, edges, tol));
  return out;
}
