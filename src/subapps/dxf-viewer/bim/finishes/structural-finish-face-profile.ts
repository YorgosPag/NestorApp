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
 * Το προφίλ μιας ομοεπίπεδης όψης έτοιμο για εξώθηση: τα (t,z) πολύγωνα (m) + το τοπικό frame
 * (origin core, dir, outward perp) για τη χαρτογράφηση σε world, + attributes/πάχος.
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
}

const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;

/** Επέκταση (m) t-άκρου σε junction γωνία: το outer band φτάνει την ακμή του γείτονα (overlap). */
interface EndExtend {
  /** t (m) του min-t άκρου να επεκταθεί, ή `null`. */
  readonly loT: number | null;
  /** t (m) του max-t άκρου να επεκταθεί, ή `null`. */
  readonly hiT: number | null;
}

/** Ένα strip → axis-aligned ορθογώνιο (t,z) σε **μέτρα**, ή `null` αν εκφυλισμένο. */
function stripRectM(
  strip: FinishStrip,
  origin: Vec2,
  dir: Vec2,
  sceneToM: number,
  thicknessM: number,
  ext: EndExtend,
): Polygon | null {
  const tA = dot(sub(strip.aCore, origin), dir) * sceneToM;
  const tB = dot(sub(strip.bCore, origin), dir) * sceneToM;
  let t0 = Math.min(tA, tB);
  let t1 = Math.max(tA, tB);
  // ADR-534 Φ7 corner-join — στο junction άκρο επεκτείνουμε το ορθογώνιο κατά το πάχος ώστε το
  // outer band να φτάσει (overlap) την ακμή της κάθετης γειτονικής όψης → μηδέν κενό στη γωνία.
  if (ext.loT !== null && Math.abs(t0 - ext.loT) < MIN_SIDE_M) t0 -= thicknessM;
  if (ext.hiT !== null && Math.abs(t1 - ext.hiT) < MIN_SIDE_M) t1 += thicknessM;
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

/** Τα δύο άκρα (min-t, max-t) μιας ομάδας: t (m) + το core σημείο (scene) + άξονας. */
interface GroupEnds {
  readonly tLoM: number;
  readonly tHiM: number;
  readonly loCoreM: Vec2;
  readonly hiCoreM: Vec2;
  readonly dir: Vec2;
}

/** Ακραία t-άκρα μιας ομάδας (σε μέτρα) + τα core σημεία τους (σε μέτρα). */
function groupEnds(group: FinishStripGroup, sceneToM: number): GroupEnds | null {
  const strips = group.strips;
  if (strips.length === 0) return null;
  const origin = strips[0].aCore;
  const dir = group.dir;
  let tLo = Infinity;
  let tHi = -Infinity;
  let loCore = origin;
  let hiCore = origin;
  for (const s of strips) {
    for (const c of [s.aCore, s.bCore]) {
      const t = dot(sub(c, origin), dir) * sceneToM;
      if (t < tLo) { tLo = t; loCore = c; }
      if (t > tHi) { tHi = t; hiCore = c; }
    }
  }
  if (!(tHi - tLo > MIN_SIDE_M)) return null;
  return {
    tLoM: tLo, tHiM: tHi,
    loCoreM: { x: loCore.x * sceneToM, y: loCore.y * sceneToM },
    hiCoreM: { x: hiCore.x * sceneToM, y: hiCore.y * sceneToM },
    dir,
  };
}

/**
 * Ένα άκρο (core σημείο P, m) είναι **γωνία** όταν κάποια ΑΛΛΗ όψη (μη-παράλληλος άξονας) έχει
 * άκρο κοντά του → εκεί οι δύο σοβάδες πρέπει να ενωθούν (overlap κατά το πάχος). Collinear
 * γείτονας (ίδιος άξονας = αλλαγή υλικού) ΔΕΝ μετρά — εκεί η ραφή είναι πραγματική.
 */
function isCornerEnd(p: Vec2, selfDir: Vec2, ends: readonly (GroupEnds | null)[], self: number, tolM: number): boolean {
  for (let j = 0; j < ends.length; j++) {
    const e = ends[j];
    if (j === self || !e) continue;
    if (Math.abs(cross(selfDir, e.dir)) < 1e-6) continue; // παράλληλος → collinear, όχι γωνία
    const dLo = Math.hypot(p.x - e.loCoreM.x, p.y - e.loCoreM.y);
    const dHi = Math.hypot(p.x - e.hiCoreM.x, p.y - e.hiCoreM.y);
    if (dLo < tolM || dHi < tolM) return true;
  }
  return false;
}

/**
 * ADR-449/534 Φ7 — SSoT: `FinishStripGroup` → `FaceProfile` (ενοποιημένο t×z profile με τρύπες).
 * Ενώνει τα ορθογώνια των strips με `safeUnion` (τα ανοίγματα μένουν ως τρύπες). `ext` επεκτείνει
 * τα junction άκρα κατά το πάχος (corner-join). `null` όταν κανένα έγκυρο ορθογώνιο. `sceneToM` =
 * scene units → μέτρα (ίδιο SSoT με `quadToScenePoints`).
 */
export function buildFaceProfile(
  group: FinishStripGroup,
  sceneToM: number,
  ext: EndExtend = { loT: null, hiT: null },
): FaceProfile | null {
  if (group.strips.length === 0) return null;
  const origin = group.strips[0].aCore;
  const thicknessM = group.seg.thickness * MM_TO_M;
  const rects: Polygon[] = [];
  for (const strip of group.strips) {
    const rect = stripRectM(strip, origin, group.dir, sceneToM, thicknessM, ext);
    if (rect) rects.push(rect);
  }
  if (rects.length === 0) return null;
  const mp: MultiPolygon = rects.length === 1 ? [rects[0]] : safeUnion(rects[0], ...rects.slice(1));
  const polygons = toProfilePolygons(mp);
  if (polygons.length === 0) return null;
  return {
    seg: group.seg,
    originCoreScene: origin,
    dir: group.dir,
    perp: group.perp,
    thicknessM,
    polygons,
  };
}

/**
 * ADR-534 Φ7 — όλα τα groups → face profiles. **Corner-join:** ανιχνεύει τα junction άκρα (γωνίες
 * με άλλη όψη) και επεκτείνει εκεί το profile κατά το πάχος → οι κάθετες ακμές των γειτονικών
 * σοβάδων **ενώνονται** (overlap, μηδέν κενό στη γωνία· big-player join geometry). Ελεύθερα άκρα
 * (χωρίς γείτονα) ΔΕΝ επεκτείνονται (κανένα nub).
 */
export function buildFaceProfiles(
  groups: readonly FinishStripGroup[],
  sceneToM: number,
): FaceProfile[] {
  const ends = groups.map((g) => groupEnds(g, sceneToM));
  const out: FaceProfile[] = [];
  for (let i = 0; i < groups.length; i++) {
    const e = ends[i];
    const tolM = Math.max(2 * groups[i].seg.thickness * MM_TO_M, 1e-3);
    const ext: EndExtend = e
      ? {
          loT: isCornerEnd(e.loCoreM, e.dir, ends, i, tolM) ? e.tLoM : null,
          hiT: isCornerEnd(e.hiCoreM, e.dir, ends, i, tolM) ? e.tHiM : null,
        }
      : { loT: null, hiT: null };
    const p = buildFaceProfile(groups[i], sceneToM, ext);
    if (p) out.push(p);
  }
  return out;
}
