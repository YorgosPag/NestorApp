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
 * ADR-534 Φ7c — Ένα γνήσιο 45° miter **ΕΝΣΩΜΑΤΩΜΕΝΟ** στο ενιαίο extrude (ΟΧΙ ξεχωριστά wedges): σε μια
 * **κάθετη γωνία** (core boundary στο τοπικό t = `tM`), το **back-cap** (u = thicknessM, outer παρειά)
 * μετατοπίζεται κατά τον άξονα κατά `deltaM` ώστε το outer t-άκρο να φτάσει τη mitered κορυφή (`aOuter/
 * bOuter` — που ήδη φέρει το `computeMiteredOuter`), ενώ το front-cap (core) μένει → η πλευρική έδρα
 * γίνεται **διαγώνια = 45° miter** μέσα στο ίδιο welded mesh. Μια όψη μπορεί να έχει **πολλαπλά** miters:
 * τα δύο t-ακρότατα (γωνίες κτιρίου) **ΚΑΙ** τα χείλη κάθε τρύπας (λαμπάδες ανοιγμάτων).
 */
export interface FaceMiterShift {
  /** Τοπικό t (m, από `originCoreScene`) του core boundary που mitered-άρεται (t-ακρότατο Ή χείλος τρύπας). */
  readonly tM: number;
  /** Μετατόπιση (m, κατά +dir) του back-cap εκεί — `t_outer − t_core` (θετικό/αρνητικό ανάλογα τη γωνία). */
  readonly deltaM: number;
}

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
  /** ADR-534 Φ7c — 45° miters (back-cap shifts) σε όλες τις κάθετες γωνίες της όψης (άκρα + λαμπάδες τρυπών). */
  readonly miter: readonly FaceMiterShift[];
}

/**
 * Ένα strip → axis-aligned ορθογώνιο (t,z) σε **μέτρα**, ή `null` αν εκφυλισμένο. Το ορθογώνιο
 * φτάνει ΑΚΡΙΒΩΣ ως το core-length (καμία γωνιακή επέκταση) — τη γωνία την κλείνει το ενσωματωμένο
 * 45° miter (back-cap shift, {@link computeFaceMiterShifts}), ΟΧΙ επέκταση του body (double-coverage)
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
  miter: readonly FaceMiterShift[] = [],
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
 * ADR-534 Φ7c — όλα τα groups → welded face profiles, το καθένα με τα **ενσωματωμένα** 45° miters του
 * (back-cap shifts σε κάθε κάθετη γωνία). Υπολογίζονται με **cross-group** perp gate ({@link
 * computeFaceMiterShifts}) → οι γωνίες (κτιρίου ΚΑΙ ανοιγμάτων/λαμπάδων) κλείνουν ΜΕΣΑ στο ενιαίο extrude.
 */
export function buildFaceProfiles(groups: readonly FinishStripGroup[], sceneToM: number): FaceProfile[] {
  const shifts = computeFaceMiterShifts(groups, sceneToM);
  const out: FaceProfile[] = [];
  for (const g of groups) {
    const p = buildFaceProfile(g, sceneToM, shifts.get(g) ?? []);
    if (p) out.push(p);
  }
  return out;
}

/** scene units (mm): outer επέκταση κατά τον άξονα > αυτό = miter (όχι chamfer/uniform-perp). */
const MITER_EXT_TOL = 1e-3;

const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;

/** Ένα core σημείο μιας όψης + ο άξονάς της (scene units) — υποψήφια πλευρά κάθετης γωνίας. */
interface FaceEnd {
  readonly pt: Vec2;
  readonly dir: Vec2;
}

/**
 * ΟΛΑ τα core άκρα (aCore/bCore κάθε strip) όλων των groups, με τον άξονα της όψης τους. Χρησιμοποιείται
 * ως αναφορά για το perp-gate: μια γωνία είναι γνήσια όταν εκεί συναντιέται **ΜΗ-παράλληλη** όψη. ΟΧΙ
 * μόνο τα group-ακρότατα (όπως πριν): στα **χείλη ανοιγμάτων** η πρόσοψη έχει την τρύπα ως εσωτερικό
 * σύνορο (όχι ακρότατο) ενώ η λαμπάδα τελειώνει εκεί — χρειάζονται ΟΛΑ τα άκρα για να «δουν» ο ένας τον
 * άλλον (αλλιώς η γωνία πρόσοψης↔λαμπάδας μένει ανοιχτή· ADR-534 Φ7c openings fix).
 */
function allFaceEnds(groups: readonly FinishStripGroup[]): FaceEnd[] {
  const out: FaceEnd[] = [];
  for (const g of groups) {
    for (const s of g.strips) {
      out.push({ pt: s.aCore, dir: g.dir });
      out.push({ pt: s.bCore, dir: g.dir });
    }
  }
  return out;
}

/**
 * Το core σημείο `p` είναι **γνήσια (κάθετη) γωνία**: υπάρχει άκρο ΑΛΛΗΣ **ΜΗ-παράλληλης** όψης εκεί
 * κοντά. Φιλτράρει τα collinear boundaries (αλλαγή υλικού στην ίδια ευθεία) — εκεί ο γείτονας είναι
 * **παράλληλος** (cross≈0) → όχι πραγματική γωνία, ούτε miter (μένει square).
 */
function isPerpCorner(p: Vec2, selfDir: Vec2, ends: readonly FaceEnd[], tol: number): boolean {
  for (const e of ends) {
    if (Math.abs(cross(selfDir, e.dir)) < 1e-6) continue; // παράλληλη → collinear, όχι γωνία
    if (Math.hypot(p.x - e.pt.x, p.y - e.pt.y) < tol) return true;
  }
  return false;
}

/**
 * Ένα strip-άκρο (core P, mitered outer O) → scalar back-cap shift `{t, delta}` (scene units) ή `null`.
 * Miter ΜΟΝΟ όταν (α) το O προβάλλεται κατά τον άξονα **ΠΕΡΑ** από το t-span του **strip** (convex
 * junction — chamfer/uniform → όχι) ΚΑΙ (β) το P είναι γνήσια κάθετη γωνία ({@link isPerpCorner}).
 * Ίδιο gating με το πρώην `endWedge`/`collectMiterWedges` (strip-level → πιάνει ΚΑΙ τα χείλη ανοιγμάτων,
 * όχι μόνο τα group-ακρότατα), αλλά κρατά ΜΟΝΟ το scalar `delta = tO − tCore` (θετικό/αρνητικό).
 */
function endShift(
  core: Vec2, outer: Vec2, tLo: number, tHi: number, dir: Vec2, ends: readonly FaceEnd[], tol: number,
): { t: number; delta: number } | null {
  const tCore = dot(core, dir);
  const tO = dot(outer, dir);
  const beyondHi = tO > tHi + MITER_EXT_TOL && Math.abs(tCore - tHi) < MITER_EXT_TOL;
  const beyondLo = tO < tLo - MITER_EXT_TOL && Math.abs(tCore - tLo) < MITER_EXT_TOL;
  if (!beyondHi && !beyondLo) return null;
  if (!isPerpCorner(core, dir, ends, tol)) return null;
  return { t: tCore, delta: tO - tCore };
}

/** Dedup ανοχή t-boundary (m) — πολλά strips μοιράζονται το ίδιο χείλος → ένα shift. */
const SHIFT_DEDUP_M = 1e-6;

/**
 * ADR-534 Φ7c — SSoT: όλα τα 45° miter back-cap shifts ανά group (σε **μέτρα**, τοπικό t από
 * `strips[0].aCore`). Σαρώνει **κάθε strip-άκρο** (όχι μόνο τα 2 group-ακρότατα): σε κάθε convex κάθετη
 * γωνία σπρώχνει το back-cap ώστε το outer να φτάσει την ήδη-υπολογισμένη mitered κορυφή (`aOuter/bOuter`
 * από `computeMiteredOuter`). Έτσι κλείνουν **ΚΑΙ** οι γωνίες κτιρίου (group-ακρότατα) **ΚΑΙ** τα χείλη
 * ανοιγμάτων (η πρόσοψη mitered-άρει το χείλος της τρύπας· η λαμπάδα mitered-άρει το άκρο της → οι δύο
 * μισές τρίγωνες γεμίζουν συμπληρωματικά, μηδέν overlap). Cross-group perp gate (collinear → square).
 */
export function computeFaceMiterShifts(
  groups: readonly FinishStripGroup[],
  sceneToM: number,
): Map<FinishStripGroup, FaceMiterShift[]> {
  const ends = allFaceEnds(groups);
  const map = new Map<FinishStripGroup, FaceMiterShift[]>();
  for (const g of groups) {
    if (g.strips.length === 0) { map.set(g, []); continue; }
    const tOrigin = dot(g.strips[0].aCore, g.dir);
    const tol = Math.max(2 * g.seg.thickness, 1); // scene units (mm): ανοχή ταύτισης γωνιακής κορυφής
    const byT = new Map<number, FaceMiterShift>();
    for (const s of g.strips) {
      const tLo = Math.min(dot(s.aCore, g.dir), dot(s.bCore, g.dir));
      const tHi = Math.max(dot(s.aCore, g.dir), dot(s.bCore, g.dir));
      for (const [core, outer] of [[s.aCore, s.aOuter], [s.bCore, s.bOuter]] as const) {
        const sh = endShift(core, outer, tLo, tHi, g.dir, ends, tol);
        if (!sh) continue;
        const tM = (sh.t - tOrigin) * sceneToM;
        const key = Math.round(tM / SHIFT_DEDUP_M);
        if (!byT.has(key)) byT.set(key, { tM, deltaM: sh.delta * sceneToM });
      }
    }
    map.set(g, [...byT.values()]);
  }
  return map;
}
