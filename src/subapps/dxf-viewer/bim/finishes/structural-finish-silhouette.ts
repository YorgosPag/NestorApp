/**
 * ADR-449 Slice 7 — Merged Structural Silhouette (ενιαίος σοβάς στις συμβολές): pure SSoT.
 *
 * Το per-element μοντέλο (Slices 1-6) υπολόγιζε τον σοβά κάθε κολόνας/δοκαριού
 * **ανεξάρτητα** με **τοπική** μεταχείριση γωνίας → στις συμβολές κολόνα↔δοκάρι ο σοβάς
 * δεν ενώνεται (Πρόβλημα Β) και ο σοβάς δοκαριού προεξέχει του υποκείμενου τοίχου
 * (Πρόβλημα Α). Revit-grade λύση: **ΕΝΙΑΙΑ ΣΙΛΟΥΕΤΑ** — ανά ζώνη ύψους ενώνουμε
 * (`safeUnion`) τα δομικά cores (κολόνες + δοκάρια) σε ΕΝΑ outline και τρέχουμε τον
 * ΥΠΑΡΧΟΝΤΑ resolver πάνω του (τοίχοι = obstacles):
 *
 *   - **Β λύνεται:** ΕΝΑ outline → οι γωνίες κλείνουν με συνεπή miter (μηδέν ασυνέχεια).
 *   - **Α λύνεται:** ο τοίχος ως obstacle αφαιρεί το τμήμα του outline που καλύπτεται
 *     (flush διεπαφή → dilation join-tol) → μηδέν προεξέχων σοβάς πάνω από τον τοίχο →
 *     η όψη του τοίχου συνεχίζεται ομοεπίπεδα.
 *
 * Pure: μηδέν globals/React/THREE/scene. REUSE-only geometry (`safeUnion` +
 * `resolveStructuralFinishFaces`) — μηδέν νέα boolean/offset λογική. Το output
 * (`SilhouetteBand[]`) το διαβάζει ο 3D builder. BOQ ΑΜΕΤΑΒΛΗΤΟ (per-element).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §3.septies
 */

import type { MultiPolygon, Pair, Polygon } from 'polygon-clipping';
import { safeUnion } from '../geometry/shared/safe-polygon-boolean';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
import { resolveStructuralFinishFaces, type FinishEdgeClassifier } from './structural-finish-resolver';
import type { StructuralFinishSpec, StructuralFinishFaces, FinishFaceSegment } from './structural-finish-types';

/** Ένα δομικό στοιχείο που συνεισφέρει το core footprint του στη σιλουέτα. */
export interface SilhouetteMember {
  /** Core footprint (plan/canvas units, CCW ή CW — ο resolver normalise-άρει). */
  readonly footprint: readonly Pt2[];
  /** mm — κάτω όριο της κατακόρυφης έκτασης του στοιχείου (building-relative). */
  readonly zBotMm: number;
  /** mm — άνω όριο (building-relative). */
  readonly zTopMm: number;
}

/** Μία κατακόρυφη ζώνη ενιαίου σοβά: faces + το z-διάστημα (building-relative mm). */
export interface SilhouetteBand {
  readonly faces: StructuralFinishFaces;
  readonly zBottomMm: number;
  readonly zTopMm: number;
}

export interface SilhouetteInput {
  /** Κολόνες + δοκάρια (core footprints + z-extents). */
  readonly members: readonly SilhouetteMember[];
  /** Footprints τοίχων (finished outline) — ΗΔΗ dilated κατά join-tol από τον caller. */
  readonly wallObstacles: readonly (readonly Pt2[])[];
  /** Per-element πρόθεση σοβά (υλικά + πάχος) — resolved default για τη σιλουέτα. */
  readonly spec: StructuralFinishSpec;
  /** Ταξινόμηση exposed υπο-ακμής σε interior/exterior (building-footprint based). */
  readonly classify: FinishEdgeClassifier;
  /** canvas-unit μήκος → ΜΕΤΡΑ (ίδια σύμβαση με τον resolver). */
  readonly unitToMeters: number;
}

const EPS = 1e-6;
const MM_TO_M = 0.001;
/** Ελάχιστο ύψος ζώνης (mm) — φιλτράρει εκφυλισμένες z-breakpoints. */
const MIN_BAND_MM = 1e-3;
/**
 * ADR-449 Slice 7 (A-fix) — μέγιστη απόσταση (mm) όπου μια όψη τοίχου θεωρείται
 * «η ομοεπίπεδη όψη» μιας δομικής ακμής. Πέρα από αυτό ο τοίχος δεν σχετίζεται.
 */
const MAX_COPLANAR_MM = 60;
/** ADR-449 Slice 7 (A-fix) — μικρό outward bias (mm) ώστε ο σοβάς να μένει μπροστά
 * από τον πυρήνα/σοβά τοίχου (αποφυγή z-fighting), ανεπαίσθητο. */
const COPLANAR_BIAS_MM = 0.5;

/** Shoelace signed area· >0 = CCW. */
function signedArea(fp: readonly Pt2[]): number {
  let s = 0;
  for (let i = 0; i < fp.length; i++) {
    const a = fp[i];
    const b = fp[(i + 1) % fp.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/**
 * Pt2[] footprint → κλειστό polygon-clipping `Polygon` (ένα ring), **κανονικοποιημένο
 * σε CCW**. ΚΡΙΣΙΜΟ: η `polygon-clipping` είναι winding-sensitive — ένα **CW** ring (π.χ.
 * το beam `buildOutlineRect` outline, signed-area<0) ερμηνεύεται ως **τρύπα** → το `safeUnion`
 * δεν θα ένωνε το δοκάρι με την κολώνα (ο σοβάς έβγαινε λάθος, εντός σώματος). CCW → solid.
 */
function footprintToPolygon(fp: readonly Pt2[]): Polygon {
  const ccw = signedArea(fp) < 0 ? [...fp].reverse() : fp;
  const ring: Pair[] = ccw.map((p) => [p.x, p.y]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push([first[0], first[1]]);
  return [ring];
}

/** polygon-clipping outer ring → Pt2[] (αφαιρεί τη διπλή κορυφή κλεισίματος). */
function outerRingToPts(ring: readonly Pair[]): Pt2[] {
  const n = ring.length;
  const pts: Pt2[] = [];
  const closed = n > 1 && ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1];
  const lim = closed ? n - 1 : n;
  for (let i = 0; i < lim; i++) pts.push({ x: ring[i][0], y: ring[i][1] });
  return pts;
}

/** Ένωση των footprints σε ΕΝΑ `MultiPolygon` (κενό όταν δεν υπάρχουν). */
function unionFootprints(footprints: readonly (readonly Pt2[])[]): MultiPolygon {
  const polys = footprints.filter((fp) => fp.length >= 3).map(footprintToPolygon);
  if (polys.length === 0) return [];
  if (polys.length === 1) return [polys[0]]; // ένα footprint → MultiPolygon χωρίς clipping
  return safeUnion(polys[0], ...polys.slice(1));
}

/** Sorted unique z-breakpoints (κάτω/άνω όρια όλων των μελών). */
function bandBreakpoints(members: readonly SilhouetteMember[]): number[] {
  const set = new Set<number>();
  for (const m of members) {
    if (m.zTopMm - m.zBotMm > MIN_BAND_MM) {
      set.add(m.zBotMm);
      set.add(m.zTopMm);
    }
  }
  return [...set].sort((a, b) => a - b);
}

/** Μέλη που υπάρχουν στο z = `mid` (κάτω συμπεριλαμβανόμενο, άνω αποκλειόμενο). */
function membersAt(members: readonly SilhouetteMember[], mid: number): SilhouetteMember[] {
  return members.filter((m) => m.zBotMm - EPS <= mid && mid < m.zTopMm - EPS);
}

interface Vec2 { x: number; y: number }

/** Όλες οι ακμές (a→b) όλων των wall obstacle πολυγώνων (finished footprints). */
function wallEdges(wallObstacles: readonly (readonly Pt2[])[]): Array<[Pt2, Pt2]> {
  const edges: Array<[Pt2, Pt2]> = [];
  for (const poly of wallObstacles) {
    if (poly.length < 2) continue;
    for (let i = 0; i < poly.length; i++) edges.push([poly[i], poly[(i + 1) % poly.length]]);
  }
  return edges;
}

/** Επικάλυψη προβολών δύο συνευθειακών τμημάτων στον κοινό άξονα `u`. */
function projectionsOverlap(a: Pt2, b: Pt2, p: Pt2, q: Pt2, u: Vec2): boolean {
  const ta = a.x * u.x + a.y * u.y;
  const tb = b.x * u.x + b.y * u.y;
  const tp = p.x * u.x + p.y * u.y;
  const tq = q.x * u.x + q.y * u.y;
  return Math.min(ta, tb) <= Math.max(tp, tq) + EPS && Math.min(tp, tq) <= Math.max(ta, tb) + EPS;
}

/**
 * ADR-449 Slice 7 (A-fix) — outward απόσταση (canvas) μέχρι την **ομοεπίπεδη** όψη
 * τοίχου της ακμής `a→b`, ή `null` αν δεν υπάρχει συνευθειακός τοίχος κοντά. Ψάχνει wall
 * edge **παράλληλη** + με **επικάλυψη προβολής** + perpendicular distance κατά τη φορά της
 * outward normal στο `[−eps, maxCanvas]`· επιστρέφει τη **κοντινότερη** (min d).
 */
function coplanarWallOffset(a: Pt2, b: Pt2, edges: readonly [Pt2, Pt2][], maxCanvas: number): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return null;
  const u: Vec2 = { x: dx / len, y: dy / len };
  const n: Vec2 = { x: dy / len, y: -dx / len }; // outward (CCW convention)
  let best: number | null = null;
  for (const [p, q] of edges) {
    const ex = q.x - p.x;
    const ey = q.y - p.y;
    const elen = Math.hypot(ex, ey);
    if (elen < EPS) continue;
    if (Math.abs((ex / elen) * u.y - (ey / elen) * u.x) > 1e-3) continue; // όχι παράλληλη
    const d = (p.x - a.x) * n.x + (p.y - a.y) * n.y; // perpendicular outward distance
    if (d < -EPS || d > maxCanvas) continue;
    if (!projectionsOverlap(a, b, p, q, u)) continue;
    if (best === null || d < best) best = d;
  }
  return best;
}

/**
 * ADR-449 Slice 7 (A-fix· Giorgio «σκαλοπάτι δοκάρι↔τοίχος») — ευθυγραμμίζει τον σοβά κάθε
 * δομικής ακμής που είναι **collinear με όψη τοίχου** ώστε η **εξωτερική όψη σοβά** να
 * προσγειώνεται **ΣΤΗΝ πλακοστρωμένη όψη του τοίχου** (όχι core+thickness → coplanar+ορατός).
 * Μετατοπίζει το segment κατά `wallOffset − thickness (+bias)` κατά την outward normal· ο
 * downstream `buildFinishSkinFromFaces` το offset-άρει κανονικά κατά `thickness` → outer στην
 * όψη τοίχου. Ακμές χωρίς συνευθειακό τοίχο → αμετάβλητες (κανονικό outward offset).
 */
function alignSegmentsToWallFaces(
  segments: readonly FinishFaceSegment[],
  wallObstacles: readonly (readonly Pt2[])[],
  s: number,
): FinishFaceSegment[] {
  if (wallObstacles.length === 0) return [...segments];
  const edges = wallEdges(wallObstacles);
  const maxCanvas = MAX_COPLANAR_MM * s;
  const biasCanvas = COPLANAR_BIAS_MM * s;
  return segments.map((seg) => {
    const tCanvas = seg.thickness * s;
    const d = coplanarWallOffset(seg.a, seg.b, edges, maxCanvas);
    if (d === null) return seg;
    const dx = seg.b.x - seg.a.x;
    const dy = seg.b.y - seg.a.y;
    const len = Math.hypot(dx, dy);
    if (len < EPS) return seg;
    const shift = d - tCanvas + biasCanvas; // outer θα προσγειωθεί στο d (+bias)
    const nx = (dy / len) * shift;
    const ny = (-dx / len) * shift;
    return { ...seg, a: { x: seg.a.x + nx, y: seg.a.y + ny }, b: { x: seg.b.x + nx, y: seg.b.y + ny } };
  });
}

/** Ενιαίες faces μιας ζώνης: union outline → resolver ανά πολύγωνο, merged. */
function resolveBandFaces(input: SilhouetteInput, present: readonly SilhouetteMember[], heightMm: number): StructuralFinishFaces {
  const merged: FinishFaceSegment[] = [];
  let interiorAreaM2 = 0;
  let exteriorAreaM2 = 0;
  for (const poly of unionFootprints(present.map((m) => m.footprint))) {
    const coreFootprint = outerRingToPts(poly[0]);
    if (coreFootprint.length < 3) continue;
    const faces = resolveStructuralFinishFaces({
      coreFootprint,
      heightMm,
      spec: input.spec,
      obstacles: input.wallObstacles,
      classify: input.classify,
      unitToMeters: input.unitToMeters,
    });
    merged.push(...faces.segments);
    interiorAreaM2 += faces.interiorAreaM2;
    exteriorAreaM2 += faces.exteriorAreaM2;
  }
  // ADR-449 Slice 7 (A-fix) — ευθυγράμμισε τις collinear-με-τοίχο ακμές στην όψη του τοίχου
  // (coplanar+ορατός σοβάς). s = canvas/mm (από unitToMeters = (1/s)·MM_TO_M).
  const s = MM_TO_M / input.unitToMeters;
  const aligned = alignSegmentsToWallFaces(merged, input.wallObstacles, s);
  return { segments: aligned, heightM: heightMm * MM_TO_M, interiorAreaM2, exteriorAreaM2 };
}

/**
 * SSoT: δομικά μέλη + τοίχοι → ενιαίες ζώνες σοβά. Σπάει το ύψος σε z-bands (όπου το
 * σύνολο των παρόντων στοιχείων είναι σταθερό)· ανά band ενώνει τα cores σε ΕΝΑ outline
 * και τρέχει τον resolver (τοίχοι = obstacles) → coplanar + connected σοβάς εγγενώς.
 * Κενό array όταν ο σοβάς είναι ανενεργός ή δεν υπάρχουν δομικά μέλη.
 */
export function computeStructuralSilhouetteBands(input: SilhouetteInput): SilhouetteBand[] {
  if (!input.spec.enabled || input.spec.thickness <= 0) return [];
  const breaks = bandBreakpoints(input.members);
  const bands: SilhouetteBand[] = [];
  for (let i = 0; i < breaks.length - 1; i++) {
    const zBottomMm = breaks[i];
    const zTopMm = breaks[i + 1];
    const heightMm = zTopMm - zBottomMm;
    if (heightMm <= MIN_BAND_MM) continue;
    const present = membersAt(input.members, (zBottomMm + zTopMm) / 2);
    if (present.length === 0) continue;
    const faces = resolveBandFaces(input, present, heightMm);
    if (faces.segments.length === 0) continue;
    bands.push({ faces, zBottomMm, zTopMm });
  }
  return bands;
}
