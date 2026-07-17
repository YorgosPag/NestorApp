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

import type { MultiPolygon, Pair, Polygon } from 'polygon-clipping';
import { safeUnion } from '../geometry/shared/safe-polygon-boolean';
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
  readonly outer: readonly Vec2[];
  readonly holes: readonly (readonly Vec2[])[];
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

/** Ένα strip → axis-aligned ορθογώνιο (t,z) σε **μέτρα**, ή `null` αν εκφυλισμένο. */
function stripRectM(
  strip: FinishStrip,
  origin: Vec2,
  dir: Vec2,
  sceneToM: number,
): Polygon | null {
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

/** polygon-clipping ring → Vec2[] (πετά τη διπλή κορυφή κλεισίματος). */
function ringToVec2(ring: readonly Pair[]): Vec2[] {
  const n = ring.length;
  const closed = n > 1 && ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1];
  const lim = closed ? n - 1 : n;
  const out: Vec2[] = [];
  for (let i = 0; i < lim; i++) out.push({ x: ring[i][0], y: ring[i][1] });
  return out;
}

/** MultiPolygon → FaceProfilePolygon[] (outer + τρύπες, ≥3 κορυφές). */
function toProfilePolygons(mp: MultiPolygon): FaceProfilePolygon[] {
  const out: FaceProfilePolygon[] = [];
  for (const poly of mp) {
    if (poly.length === 0) continue;
    const outer = ringToVec2(poly[0]);
    if (outer.length < 3) continue;
    const holes: Vec2[][] = [];
    for (let ri = 1; ri < poly.length; ri++) {
      const hole = ringToVec2(poly[ri]);
      if (hole.length >= 3) holes.push(hole);
    }
    out.push({ outer, holes });
  }
  return out;
}

/**
 * ADR-449/534 Φ7 — SSoT: `FinishStripGroup` → `FaceProfile` (ενοποιημένο t×z profile με τρύπες).
 * Ενώνει τα ορθογώνια των strips με `safeUnion` (τα ανοίγματα μένουν ως τρύπες). `null` όταν
 * κανένα έγκυρο ορθογώνιο. `sceneToM` = scene units → μέτρα (ίδιο SSoT με `quadToScenePoints`).
 */
export function buildFaceProfile(group: FinishStripGroup, sceneToM: number): FaceProfile | null {
  if (group.strips.length === 0) return null;
  const origin = group.strips[0].aCore;
  const rects: Polygon[] = [];
  for (const strip of group.strips) {
    const rect = stripRectM(strip, origin, group.dir, sceneToM);
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
    thicknessM: group.seg.thickness * MM_TO_M,
    polygons,
  };
}

/** Όλα τα groups → face profiles (φιλτράρει τα κενά). */
export function buildFaceProfiles(
  groups: readonly FinishStripGroup[],
  sceneToM: number,
): FaceProfile[] {
  const out: FaceProfile[] = [];
  for (const g of groups) {
    const p = buildFaceProfile(g, sceneToM);
    if (p) out.push(p);
  }
  return out;
}
