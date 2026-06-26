/**
 * ADR-534 Φ2 — **Υποδιαίρεση της ενιαίας πλάκας οροφής σε φατνώματα** από τα εσωτερικά
 * δομικά μέλη (δοκάρια/τοιχία), ΟΧΙ από DXF χωρίσματα ή τόξα πορτών.
 *
 * Παίρνει το **ενιαίο περίγραμμα κτιρίου** (v4 union, master region) + τους **άξονες των
 * δοκαριών** (location lines, ADR-529) + τις **κεντρικές γραμμές των τοιχίων** ως κόπτες και
 * χτίζει το planar arrangement με τον ΙΔΙΟ SSoT `findClosedPolygonsFromLines` (auto-area).
 * Κάθε εσωτερικό face = ένα φάτνωμα (πλήρης κάλυψη, partition στον άξονα του δοκαριού → το
 * soffit κάνει σκαλοπάτι εκεί). DXF γραμμές/τόξα **δεν** μπαίνουν στους κόπτες by construction.
 *
 * Pure (scene units). Ο caller (`ceiling-slab-from-structure`) δημιουργεί μία πλάκα ανά bay.
 *
 * @see ../../systems/auto-area/auto-area-geometry.ts — findClosedPolygonsFromLines (SSoT)
 * @see ./ceiling-slab-from-structure.ts — caller (master region + cutters)
 * @see docs/centralized-systems/reference/adrs/ADR-534-auto-ceiling-slab-per-bay.md §Φ2
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import { mmToSceneUnits } from '../../utils/scene-units';
import { findClosedPolygonsFromLines } from '../../systems/auto-area/auto-area-geometry';
import { polygonArea, polygonCentroid } from '../walls/perimeter-polygon-math';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';

/** Ένα φάτνωμα οροφής — outline + άνοιγμα σχεδιασμού + αν είναι εσωτερικό (για K). */
export interface CeilingBay {
  readonly ring: Point2D[];
  /** Ελεύθερο άνοιγμα (mm) — η μικρότερη διάσταση bbox (two-way conservative). */
  readonly spanMm: number;
  /** `true` αν καμία ακμή δεν πέφτει στην περίμετρο κτιρίου (πάκτωση παντού → continuous). */
  readonly interior: boolean;
}

/** Ελάχιστο εμβαδόν φατνώματος (mm²) — κόβει εκφυλισμένα. 0.5 m². */
const MIN_BAY_AREA_MM2 = 0.5e6;
/** Ελάχιστο υδραυλικό πλάτος φατνώματος (mm) — κόβει sliver λωρίδες ανάμεσα σε διπλούς άξονες. */
const MIN_BAY_WIDTH_MM = 300;

interface Bbox { minX: number; minY: number; maxX: number; maxY: number; }

function bboxOf(ring: readonly Point2D[]): Bbox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of ring) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Επέκτεινε ένα τμήμα κατά `by` και στα δύο άκρα (κατά τη διεύθυνσή του). Ο άξονας εσωτερικού
 * δοκαριού σταματά στα άκρα του (στους περιμετρικούς άξονες), λίγο **πριν** την εξωτερική παρειά
 * → δεν φτάνει το όριο → δεν τεμαχίζει. Η επέκταση εγγυάται διέλευση (το arrangement κλιπάρει στο
 * πραγματικό όριο)· τυχόν τμήμα εκτός region → εξωτερικό face → φιλτράρεται με centroid-inside.
 */
function extendSegment([a, b]: readonly [Point2D, Point2D], by: number): [Point2D, Point2D] {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len <= 0) return [a, b];
  const ux = (dx / len) * by, uy = (dy / len) * by;
  return [{ x: a.x - ux, y: a.y - uy }, { x: b.x + ux, y: b.y + uy }];
}

function ringPerimeter(ring: readonly Point2D[]): number {
  let p = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    p += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return p;
}

/** Απόσταση σημείου από ευθύγραμμο τμήμα [a,b]. */
function pointSegmentDist(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Ελάχιστη απόσταση σημείου από την περίμετρο (όλες τις ακμές) ενός ring. */
function distToRingBoundary(p: Point2D, ring: readonly Point2D[]): number {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    best = Math.min(best, pointSegmentDist(p, ring[i], ring[(i + 1) % ring.length]));
  }
  return best;
}

/** `true` αν το σημείο πέφτει (εντός tol) πάνω σε ≥1 ακμή του ring (= πάνω στην περίμετρο). */
function pointOnRingBoundary(p: Point2D, ring: readonly Point2D[], tol: number): boolean {
  return distToRingBoundary(p, ring) <= tol;
}

/**
 * Κράτα μόνο τους **εσωτερικούς** κόπτες: αυτούς που διασχίζουν το εσωτερικό (≥1 σημείο μακριά από
 * την περίμετρο > `minDist`). Οι άξονες **περιμετρικών** δοκαριών τρέχουν παράλληλα & κοντά στην
 * παρειά (half-width μέσα) → απορρίπτονται ώστε η πλάκα να καλύπτει ΟΛΟ το περίγραμμα (όπως v4, T-beam
 * flange)· μόνο τα εσωτερικά δοκάρια/τοιχία χωρίζουν φατνώματα.
 */
function internalCuttersOnly(
  cutters: ReadonlyArray<readonly [Point2D, Point2D]>,
  masterRing: readonly Point2D[],
  minDist: number,
): [Point2D, Point2D][] {
  const out: [Point2D, Point2D][] = [];
  for (const [a, b] of cutters) {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const maxDist = Math.max(
      distToRingBoundary(a, masterRing),
      distToRingBoundary(b, masterRing),
      distToRingBoundary(mid, masterRing),
    );
    if (maxDist > minDist) out.push([a, b]);
  }
  return out;
}

/** Εσωτερικό φάτνωμα ⇔ καμία ακμή του (μέσο) δεν ακουμπά την περίμετρο του master region. */
function isInteriorBay(face: readonly Point2D[], masterRing: readonly Point2D[], tol: number): boolean {
  for (let i = 0; i < face.length; i++) {
    const a = face[i];
    const b = face[(i + 1) % face.length];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (pointOnRingBoundary(mid, masterRing, tol)) return false;
  }
  return true;
}

/**
 * Υποδιαίρεσε ΕΝΑ master region (outer ring) σε φατνώματα με τους δοθέντες κόπτες (άξονες
 * δοκαριών + κεντρικές γραμμές τοιχίων). Χωρίς κόπτες → επιστρέφει το ίδιο το region ως ΕΝΑ
 * φάτνωμα (μηδέν εσωτερική διακοπή). Slivers (διπλοί άξονες) φιλτράρονται με υδραυλικό πλάτος.
 */
export function subdivideIntoBays(
  masterRing: readonly Point2D[],
  cutters: ReadonlyArray<readonly [Point2D, Point2D]>,
  mergeTol: number,
  sceneUnits: SceneUnits,
): CeilingBay[] {
  if (masterRing.length < 3) return [];
  const s = mmToSceneUnits(sceneUnits);
  const minAreaScene = MIN_BAY_AREA_MM2 * s * s;
  const minWidthScene = MIN_BAY_WIDTH_MM * s;

  const bb = bboxOf(masterRing);
  const diag = Math.hypot(bb.maxX - bb.minX, bb.maxY - bb.minY);

  const graph: [Point2D, Point2D][] = [];
  for (let i = 0; i < masterRing.length; i++) {
    graph.push([masterRing[i], masterRing[(i + 1) % masterRing.length]]);
  }
  // Μόνο εσωτερικοί κόπτες → η περίμετρος μένει άθικτη (πλήρης κάλυψη v4), εσωτερικά δοκάρια χωρίζουν.
  // Επεκτείνονται ώστε να φτάνουν/περνούν το όριο (αλλιώς ο άξονας σταματά half-width πριν την παρειά).
  for (const c of internalCuttersOnly(cutters, masterRing, minWidthScene)) {
    graph.push(extendSegment(c, diag));
  }

  const faces = findClosedPolygonsFromLines(graph, mergeTol, 0);

  const bays: CeilingBay[] = [];
  for (const face of faces) {
    if (face.length < 3) continue;
    const area = polygonArea(face);
    if (area < minAreaScene) continue;
    const perim = ringPerimeter(face);
    if (perim <= 0 || (2 * area) / perim < minWidthScene) continue;
    // Κράτα μόνο τα faces ΜΕΣΑ στο master region (κόβει εξωτερικά faces από κόπτες που προεξέχουν).
    if (!isPointInPolygon(polygonCentroid(face), masterRing as Point2D[])) continue;
    const bb = bboxOf(face);
    const spanMm = Math.min(bb.maxX - bb.minX, bb.maxY - bb.minY) / s;
    bays.push({ ring: face, spanMm, interior: isInteriorBay(face, masterRing, mergeTol) });
  }
  return bays;
}
