/**
 * ADR-526 Φ6c (Tekton .TEK IMPORT) — καθαρισμός των stair-generated `<plane>` (μπετόν σκαλοπατιών).
 *
 * Ο Τέκτων εξάγει τον όγκο μπετού κάθε σκαλοπατιού ως **τριγωνοποιημένο 3Δ mesh**: για κάθε πάτημα
 * μια ΟΡΘΟΓΩΝΙΑ άνω όψη (4 κορυφές, στο ύψος της πάνω παρειάς) ΚΑΙ 2 ΤΡΙΓΩΝΙΚΕΣ όψεις (η ίδια
 * βάση, στο ύψος του «καθίσματος» = 1 πάχος πλάκας χαμηλότερα). Εισαγόμενα ως slabs δίνουν **δύο
 * σειρές «ψωμιών»** — οι ορθογώνιες πολύ ψηλά, οι τριγωνικές (διπλότυπες) στο σωστό ύψος.
 *
 * Καθαρισμός (Giorgio 2026-07-11): πετάμε τις τριγωνικές και **κατεβάζουμε** τις ορθογώνιες στο
 * ύψος του καθίσματος (μία σειρά καθαρών ορθογώνιων πλακών ανά σκαλοπάτι). Εφαρμόζεται ΜΟΝΟ σε
 * πλάκες που είναι stair-generated (elev1≈0 + εντός του footprint σκάλας) — κανονικές δομικές
 * πλάκες μένουν ανέπαφες.
 *
 * @module io/tek/tek-stair-plane-refine
 */

import type { TekPlaneRecord, TekStairRecord, TekPoint2D } from './tek-import-types';

/** Περιθώριο (μέτρα) γύρω από το footprint σκάλας για το «ανήκει σε σκάλα». */
const STAIR_BBOX_MARGIN_M = 0.15;
/** Κάτω από αυτό το |elev1| (μέτρα) η πλάκα θεωρείται stair-generated (ο Τέκτων αφήνει elev1=0). */
const ELEV1_EPS = 1e-6;

interface BBox { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number; }

/** BBox (μέτρα) των κορυφών μιας σκάλας — αγνοεί sentinel `(0,0)` του Τέκτονα. */
function stairBBox(stair: TekStairRecord): BBox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pl of stair.polylines) {
    for (const p of pl) {
      if (p.x === 0 && p.y === 0) continue;
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/** Κεντροειδές (μέτρα) των κορυφών μιας πλάκας. */
function centroid(vertices: readonly TekPoint2D[]): TekPoint2D {
  const s = vertices.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / vertices.length, y: s.y / vertices.length };
}

/** `true` αν το κέντρο της πλάκας πέφτει εντός ενός stair bbox (+ περιθώριο). */
function insideAnyStair(vertices: readonly TekPoint2D[], boxes: readonly BBox[]): boolean {
  const c = centroid(vertices);
  const m = STAIR_BBOX_MARGIN_M;
  return boxes.some((b) => c.x >= b.minX - m && c.x <= b.maxX + m && c.y >= b.minY - m && c.y <= b.maxY + m);
}

/** Διάμεσος μιας λίστας αριθμών (0 για κενή). */
function median(nums: readonly number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Μεγαλύτερο επίπεδο τριγώνων ≤ `z` (το «κάθισμα» κάτω από την ορθογώνια όψη), ή `null`. */
function nearestBelow(z: number, sortedTriZ: readonly number[]): number | null {
  let best: number | null = null;
  for (const t of sortedTriZ) {
    if (t <= z + 1e-9) best = t; else break;
  }
  return best;
}

/**
 * Καθαρίζει τις stair-generated πλάκες: αφαιρεί τις τριγωνικές όψεις και κατεβάζει τις ορθογώνιες
 * κατά το πάχος μπετού (διάμεσος του κενού ορθογώνιας↔τριγωνικής) στο ύψος του καθίσματος.
 * Επιστρέφει νέα λίστα planes· μη-stair πλάκες αμετάβλητες.
 */
export function refineStairMeshPlanes(
  planes: readonly TekPlaneRecord[],
  stairs: readonly TekStairRecord[],
): TekPlaneRecord[] {
  const boxes = stairs.map(stairBBox).filter((b): b is BBox => b !== null);
  if (boxes.length === 0) return [...planes];
  const isStairMesh = (p: TekPlaneRecord): boolean =>
    Math.abs(p.elevationM) < ELEV1_EPS && insideAnyStair(p.vertices, boxes);
  const stairPlanes = planes.filter(isStairMesh);
  if (stairPlanes.length === 0) return [...planes];

  const triZ = stairPlanes
    .filter((p) => p.vertices.length === 3)
    .map((p) => p.baseElevationM ?? 0)
    .sort((a, b) => a - b);
  const quads = stairPlanes.filter((p) => p.vertices.length >= 4);
  const drops: number[] = [];
  for (const q of quads) {
    const nb = nearestBelow(q.baseElevationM ?? 0, triZ);
    if (nb !== null) drops.push((q.baseElevationM ?? 0) - nb);
  }
  const drop = median(drops);
  const refinedQuads = quads.map((q) => ({ ...q, baseElevationM: (q.baseElevationM ?? 0) - drop }));
  return [...planes.filter((p) => !isStairMesh(p)), ...refinedQuads];
}
