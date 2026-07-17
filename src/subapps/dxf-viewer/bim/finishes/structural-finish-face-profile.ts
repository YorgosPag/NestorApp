/**
 * ADR-449/534 Φ7 — Coplanar face profile (unified welded σοβάς): pure SSoT.
 *
 * Πρόβλημα (diagnostic 2026-07-18): ο 3Δ builder εξωθούσε **ΕΝΑ κλειστό prism ΑΝΑ strip**.
 * Μια ομοεπίπεδη πρόσοψη με ανοίγματα/σκαλιά αποσυντίθεται σε πολλά ορθογώνια strips (μη-ορθογώνια
 * περιοχή δεν γίνεται ΕΝΑ strip) → τα πλευρικά side-faces δύο γειτονικών prisms = οι ραφές που
 * βλέπει ο Giorgio (3Δ + C4D OBJ). Λ1 (merge strips) ΔΕΝ μπορεί να τις σβήσει (irreducible «Π»
 * γύρω από παράθυρο).
 *
 * Λύση (big-player — Revit «join geometry» / C4D weld): ανά **ομοεπίπεδη όψη** (`FinishStripGroup`)
 * ενώνουμε τα (t × z) ορθογώνια των strips σε ΕΝΑ πολύγωνο (με **τρύπες** στα ανοίγματα) στο τοπικό
 * κατακόρυφο επίπεδο της όψης (t = κατά μήκος, z = ύψος), και ο 3Δ το εξωθεί **ΜΙΑ φορά** κατά το
 * πάχος → ΕΝΑ συνεχές welded δέρμα, μηδέν εσωτερικό τοίχωμα. Ραφή μένει ΜΟΝΟ σε πραγματικό όριο:
 * περίγραμμα όψης (γωνία = άλλο group), χείλος ανοίγματος (τρύπα), αλλαγή υλικού/χρώματος (άλλο group).
 *
 * Reuse-only geometry: `safeUnion` (ADR — polygon-clipping SSoT) για την ένωση των ορθογωνίων.
 * Pure: μηδέν globals/React/THREE/scene. Το output το καταναλώνει ο `buildFinishSkinFromStripGroups`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §Φ7
 * @see ./structural-finish-vertical-merge.ts — παράγει τα `FinishStripGroup`
 */

import type { MultiPolygon, Polygon } from 'polygon-clipping';
import { safeUnion } from '../geometry/shared/safe-polygon-boolean';
import { pairRingToPt2 } from '../geometry/shared/polygon-clipping-ring';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
import type { Vec2 } from './structural-finish-outline-geometry';
import type { FinishStrip, FinishStripGroup } from './structural-finish-vertical-merge';
import type { FinishFaceSegment } from './structural-finish-types';

const MM_TO_M = 0.001;
/** Ελάχιστη πλευρά ορθογωνίου (m) — φιλτράρει εκφυλισμένα strips πριν το union. */
const MIN_SIDE_M = 1e-6;

const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });

/**
 * Ένα κλειστό polygon (outer ring + τρύπες) στο τοπικό επίπεδο όψης, σε **μέτρα** (x = t κατά
 * μήκος, y = z ύψος). Το εξωθεί ο 3Δ builder κατά `thicknessM` (outward perp) → welded δέρμα.
 */
export interface FaceProfilePolygon {
  readonly outer: readonly Pt2[];
  readonly holes: readonly (readonly Pt2[])[];
}

/**
 * ADR-534 Φ7c — Γνήσιο 45° miter **ΕΝΣΩΜΑΤΩΜΕΝΟ** στο ενιαίο extrude (ΟΧΙ ξεχωριστά wedges): τα δύο
 * t-ακρότατα της όψης + το πόσο μετατοπίζεται εκεί το **back-cap** (u = thicknessM, outer παρειά) κατά
 * τον άξονα ώστε το outer t-άκρο να φτάσει τη mitered κορυφή (`aOuter/bOuter` — που ήδη φέρει το
 * `computeMiteredOuter`), ενώ το front-cap (core) μένει στο core-length → η πλευρική έδρα γίνεται
 * **διαγώνια = 45° miter** μέσα στο ίδιο welded mesh. Μη-μηδενικό delta ΜΟΝΟ σε **convex κάθετη γωνία**.
 */
export interface FaceMiterDeltas {
  /** Τοπικό t (m, από `originCoreScene`) του min-t core ακρότατου (κάτω t-άκρο του profile). */
  readonly tLoM: number;
  /** Τοπικό t (m) του max-t core ακρότατου (πάνω t-άκρο). */
  readonly tHiM: number;
  /** Μετατόπιση (m, κατά +dir) του back-cap στο tLo — convex → αρνητικό (έξω)· αλλιώς 0. */
  readonly deltaLoM: number;
  /** Μετατόπιση (m, κατά +dir) του back-cap στο tHi — convex → θετικό (έξω)· αλλιώς 0. */
  readonly deltaHiM: number;
}

/** Μηδενικό miter (square end-caps) — free ends / concave / collinear / junction. */
export const ZERO_MITER: FaceMiterDeltas = { tLoM: 0, tHiM: 0, deltaLoM: 0, deltaHiM: 0 };

/**
 * Το προφίλ μιας ομοεπίπεδης όψης έτοιμο για εξώθηση: τα (t,z) πολύγωνα (m) + το τοπικό frame
 * (origin core, dir, outward perp) για τη χαρτογράφηση σε world, + attributes/πάχος + miter deltas.
 */
export interface FaceProfile {
  readonly seg: FinishFaceSegment;
  /** Core σημείο αναφοράς (scene units) → world origin του τοπικού (t=0, z=0, u=0). */
  readonly originCoreScene: Vec2;
  /** Μοναδιαίος άξονας κατά μήκος (plan). */
  readonly dir: Vec2;
  /** Μοναδιαίο outward normal (plan) — κατεύθυνση εξώθησης πάχους. */
  readonly perp: Vec2;
  /** Πάχος σοβά (m) = seg.thickness · mm→m. */
  readonly thicknessM: number;
  readonly polygons: readonly FaceProfilePolygon[];
  /** ADR-534 Φ7c — 45° miter deltas (back-cap shift) των δύο t-άκρων· `ZERO_MITER` όταν καμία γωνία. */
  readonly miter: FaceMiterDeltas;
}

/**
 * Ένα strip → axis-aligned ορθογώνιο (t,z) σε **μέτρα**, ή `null` αν εκφυλισμένο. Το ορθογώνιο
 * φτάνει ΑΚΡΙΒΩΣ ως το core-length (καμία γωνιακή επέκταση) — τη γωνία την κλείνει το ενσωματωμένο
 * 45° miter (back-cap shift, {@link computeFaceMiterDeltas}), ΟΧΙ επέκταση του body (double-coverage)
 * ΟΥΤΕ ξεχωριστό wedge (coincident face → artifact· ADR-534 Φ7c αντικατέστησε το Φ7b wedge-hack).
 */
function stripRectM(strip: FinishStrip, origin: Vec2, dir: Vec2, sceneToM: number): Polygon | null {
  const tA = dot(sub(strip.aCore, origin), dir) * sceneToM;
  const tB = dot(sub(strip.bCore, origin), dir) * sceneToM;
  const t0 = Math.min(tA, tB);
  const t1 = Math.max(tA, tB);
  const z0 = strip.zBottomMm * MM_TO_M;
  const z1 = strip.zTopMm * MM_TO_M;
  if (t1 - t0 < MIN_SIDE_M || z1 - z0 < MIN_SIDE_M) return null;
  // CCW closed ring (t,z).
  return [[[t0, z0], [t1, z0], [t1, z1], [t0, z1], [t0, z0]]];
}

/** MultiPolygon → FaceProfilePolygon[] (outer + τρύπες, ≥3 κορυφές). */
function toProfilePolygons(mp: MultiPolygon): FaceProfilePolygon[] {
  const out: FaceProfilePolygon[] = [];
  for (const poly of mp) {
    if (poly.length === 0) continue;
    const outer = pairRingToPt2(poly[0]);
    if (outer.length < 3) continue;
    const holes: Pt2[][] = [];
    for (let ri = 1; ri < poly.length; ri++) {
      const hole = pairRingToPt2(poly[ri]);
      if (hole.length >= 3) holes.push(hole);
    }
    out.push({ outer, holes });
  }
  return out;
}

/**
 * ADR-449/534 Φ7 — SSoT: `FinishStripGroup` → `FaceProfile` (ενοποιημένο t×z profile με τρύπες).
 * Ενώνει τα ορθογώνια των strips με `safeUnion` (τα ανοίγματα μένουν ως τρύπες), **ως το πραγματικό
 * core-length** (καμία γωνιακή επέκταση). `null` όταν κανένα έγκυρο ορθογώνιο. `sceneToM` = scene
 * units → μέτρα (ίδιο SSoT με `quadToScenePoints`).
 */
export function buildFaceProfile(
  group: FinishStripGroup,
  sceneToM: number,
  miter: FaceMiterDeltas = ZERO_MITER,
): FaceProfile | null {
  if (group.strips.length === 0) return null;
  const origin = group.strips[0].aCore;
  const thicknessM = group.seg.thickness * MM_TO_M;
  const rects: Polygon[] = [];
  for (const strip of group.strips) {
    const rect = stripRectM(strip, origin, group.dir, sceneToM);
    if (rect) rects.push(rect);
  }
  if (rects.length === 0) return null;
  const mp: MultiPolygon = rects.length === 1 ? [rects[0]] : safeUnion(rects[0], ...rects.slice(1));
  const polygons = toProfilePolygons(mp);
  if (polygons.length === 0) return null;
  return { seg: group.seg, originCoreScene: origin, dir: group.dir, perp: group.perp, thicknessM, polygons, miter };
}

/**
 * ADR-534 Φ7c — όλα τα groups → welded face profiles, το καθένα με το **ενσωματωμένο** 45° miter του
 * (back-cap deltas ανά t-άκρο). Το miter υπολογίζεται με **cross-group** perp gate ({@link
 * computeFaceMiterDeltas}) → η γωνία κλείνει ΜΕΣΑ στο ενιαίο extrude, μηδέν ξεχωριστό wedge.
 */
export function buildFaceProfiles(groups: readonly FinishStripGroup[], sceneToM: number): FaceProfile[] {
  const deltas = computeFaceMiterDeltas(groups, sceneToM);
  const out: FaceProfile[] = [];
  for (const g of groups) {
    const p = buildFaceProfile(g, sceneToM, deltas.get(g) ?? ZERO_MITER);
    if (p) out.push(p);
  }
  return out;
}

/** scene units (mm): outer επέκταση κατά τον άξονα > αυτό = miter (όχι chamfer/uniform-perp). */
const MITER_EXT_TOL = 1e-3;

const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;

/** Ένα ακρότατο (min-t Ή max-t) core σημείο μιας ομάδας + ο άξονάς της (scene units). */
interface GroupEnd {
  readonly pt: Vec2;
  readonly dir: Vec2;
}

/** Τα δύο ακρότατα (min-t, max-t) core σημεία μιας ομάδας — εκεί «τελειώνει» η όψη (πιθανή γωνία). */
function groupExtremities(g: FinishStripGroup): GroupEnd[] {
  let tLo = Infinity;
  let tHi = -Infinity;
  let lo = g.strips[0].aCore;
  let hi = g.strips[0].aCore;
  for (const s of g.strips) {
    for (const c of [s.aCore, s.bCore]) {
      const t = dot(c, g.dir);
      if (t < tLo) { tLo = t; lo = c; }
      if (t > tHi) { tHi = t; hi = c; }
    }
  }
  return [{ pt: lo, dir: g.dir }, { pt: hi, dir: g.dir }];
}

/**
 * Το core σημείο `p` είναι **γνήσια (κάθετη) γωνία**: υπάρχει ακρότατο ΑΛΛΗΣ **ΜΗ-παράλληλης** όψης
 * εκεί κοντά. Φιλτράρει τα collinear εσωτερικά boundaries (window jamb / αλλαγή υλικού) — εκεί το
 * `outerAt` του γείτονα δίνει chamfer outer που φαίνεται «επεκταμένο», ΑΛΛΑ δεν είναι πραγματική γωνία.
 */
function isPerpCorner(p: Vec2, selfDir: Vec2, ends: readonly GroupEnd[], tol: number): boolean {
  for (const e of ends) {
    if (Math.abs(cross(selfDir, e.dir)) < 1e-6) continue; // παράλληλη → collinear, όχι γωνία
    if (Math.hypot(p.x - e.pt.x, p.y - e.pt.y) < tol) return true;
  }
  return false;
}

/** Ένα t-ακρότατο μιας ομάδας: το core σημείο, το mitered outer του, και το t = dot(core, dir). */
interface GroupCorner {
  readonly core: Vec2;
  readonly outer: Vec2;
  readonly t: number;
}

/** Τα δύο t-ακρότατα (min-t, max-t) core σημεία μιας ομάδας + το mitered outer του καθενός. */
function groupCorners(g: FinishStripGroup): { lo: GroupCorner; hi: GroupCorner } {
  const first: GroupCorner = { core: g.strips[0].aCore, outer: g.strips[0].aOuter, t: dot(g.strips[0].aCore, g.dir) };
  let lo = first;
  let hi = first;
  for (const s of g.strips) {
    for (const [core, outer] of [[s.aCore, s.aOuter], [s.bCore, s.bOuter]] as const) {
      const t = dot(core, g.dir);
      if (t < lo.t) lo = { core, outer, t };
      if (t > hi.t) hi = { core, outer, t };
    }
  }
  return { lo, hi };
}

/**
 * Scalar back-cap delta (scene units) ενός t-άκρου: μη-μηδενικό ΜΟΝΟ όταν (α) το mitered outer
 * προβάλλεται κατά τον άξονα **ΠΕΡΑ** από το core t (convex — `beyondSign>0` για max-t, `<0` για
 * min-t) ΚΑΙ (β) το core είναι **γνήσια κάθετη γωνία** ({@link isPerpCorner}). Concave (outer εντός),
 * junction (outer==core), collinear/window-jamb (παράλληλος γείτονας), free/wall-butt → 0 (square).
 * Επιστρέφει `tOuter − tCore`: max-t → θετικό (έξω)· min-t → αρνητικό (έξω).
 */
function endDelta(c: GroupCorner, beyondSign: 1 | -1, dir: Vec2, ends: readonly GroupEnd[], tol: number): number {
  const tOuter = dot(c.outer, dir);
  const beyond = beyondSign > 0 ? tOuter > c.t + MITER_EXT_TOL : tOuter < c.t - MITER_EXT_TOL;
  if (!beyond || !isPerpCorner(c.core, dir, ends, tol)) return 0;
  return tOuter - c.t;
}

/**
 * ADR-534 Φ7c — SSoT: 45° miter deltas ανά group (σε **μέτρα**, τοπικό t από `strips[0].aCore`). Το
 * back-cap (outer παρειά) κάθε όψης σπρώχνεται στα t-άκρα ώστε να φτάσει τη **κοινή** mitered κορυφή
 * (`aOuter/bOuter`, από `computeMiteredOuter`) → η γωνία κλείνει **ΜΕΣΑ** στο ενιαίο extrude, μηδέν
 * ξεχωριστό wedge. Convex + **cross-group** perp gate (window jambs / collinear μένουν square). Ίδια
 * λογική γωνιακής επιλογής με το πρώην `collectMiterWedges`, αλλά κρατά ΜΟΝΟ το scalar delta.
 */
export function computeFaceMiterDeltas(
  groups: readonly FinishStripGroup[],
  sceneToM: number,
): Map<FinishStripGroup, FaceMiterDeltas> {
  const ends = groups.flatMap(groupExtremities);
  const map = new Map<FinishStripGroup, FaceMiterDeltas>();
  for (const g of groups) {
    if (g.strips.length === 0) { map.set(g, ZERO_MITER); continue; }
    const tOrigin = dot(g.strips[0].aCore, g.dir);
    const tol = Math.max(2 * g.seg.thickness, 1); // scene units (mm): ανοχή ταύτισης γωνιακής κορυφής
    const { lo, hi } = groupCorners(g);
    map.set(g, {
      tLoM: (lo.t - tOrigin) * sceneToM,
      tHiM: (hi.t - tOrigin) * sceneToM,
      deltaLoM: endDelta(lo, -1, g.dir, ends, tol) * sceneToM,
      deltaHiM: endDelta(hi, 1, g.dir, ends, tol) * sceneToM,
    });
  }
  return map;
}
