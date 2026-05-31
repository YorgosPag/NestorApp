/**
 * safe-polygon-boolean.ts — robust + crash-proof SSoT wrapper γύρω από
 * `polygon-clipping` (MIT). ADR-396 (ETICS) hotfix.
 *
 * ΕΝΑΣ τόπος για boolean `union`/`intersection` footprints. Λύνει δύο γνωστά
 * προβλήματα της `polygon-clipping@0.15.7`:
 *
 *  1. **Precision σε μικρή κλίμακα (root cause):** ο sweep-line της lib είναι
 *     εύθραυστος όταν οι συντεταγμένες έχουν πολύ μικρό μέγεθος (meter-scenes,
 *     ~0–5) → πετάει «Unable to complete output ring». Κλιμακώνουμε ΟΛΑ τα inputs
 *     με ΕΝΑΝ κοινό affine (translate σε bbox-min + scale ώστε bbox diagonal →
 *     `ROBUST_SPAN`) πριν το op, και επαναφέρουμε το αποτέλεσμα. Έτσι m-scenes
 *     συμπεριφέρονται σαν mm-scenes· uniform scale = topology-invariant.
 *
 *  2. **Crash ολόκληρου του route:** οποιοδήποτε throw της lib ανέβαινε
 *     ανεμπόδιστο και έριχνε ΟΛΟ το /dxf/viewer (`RouteErrorFallback`).
 *     Belt-and-suspenders: try/catch → log + graceful fallback (κενή
 *     MultiPolygon). Ένα geometry edge-case ΠΟΤΕ δεν ρίχνει τον viewer.
 *
 * Input space == output space (το scaling είναι εσωτερικό & διάφανο) → οι callers
 * δεν αλλάζουν το δικό τους offset/attribution handling.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3.1
 * @see bim/geometry/building-footprint.ts — boolean union footprints
 * @see bim/geometry/footprint-region-classifier.ts — hole-coverage intersection
 */

import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Pair, Polygon } from 'polygon-clipping';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('SafePolygonBoolean');

/** Ό,τι δέχεται η polygon-clipping ως είσοδο (single polygon ή multi). */
export type ClipGeom = Polygon | MultiPolygon;

/** Στόχος bbox-diagonal μετά το scaling — εύρωστο εύρος του sweep-line. */
const ROBUST_SPAN = 1e4;
/** Κάτω από αυτό το span (input units) η σκηνή είναι degenerate → χωρίς scaling. */
const MIN_SPAN = 1e-9;

const EMPTY: MultiPolygon = [];

/** Αναδρομικός κόμβος συντεταγμένων: φύλλο `Pair` ή υποδέντρο. */
type CoordNode = Pair | readonly CoordNode[];

/** Leaf-guard: ένα `Pair` είναι `[number, number]` (πρώτο στοιχείο = number). */
function isPair(node: CoordNode): node is Pair {
  return typeof node[0] === 'number';
}

/** Επισκέπτεται κάθε `Pair` του δέντρου (για bbox). */
function eachPair(node: CoordNode, visit: (p: Pair) => void): void {
  if (isPair(node)) {
    visit(node);
    return;
  }
  for (const child of node) eachPair(child, visit);
}

/** Αντιστοιχίζει κάθε `Pair` διατηρώντας τη δομή (για scale/unscale). */
function mapNode(node: CoordNode, fn: (p: Pair) => Pair): CoordNode {
  if (isPair(node)) return fn(node);
  return node.map((child) => mapNode(child, fn));
}

type ClipOp = (geom: ClipGeom, ...geoms: ClipGeom[]) => MultiPolygon;

/**
 * Τρέχει ένα polygon-clipping op σε εύρωστη κλίμακα, με graceful fallback.
 * Όλα τα inputs μοιράζονται ΤΟΝ ΙΔΙΟ affine (υποχρεωτικό για σωστό boolean).
 */
function runScaled(op: ClipOp, opName: string, geoms: readonly ClipGeom[]): MultiPolygon {
  if (geoms.length === 0) return EMPTY;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const g of geoms) {
    eachPair(g, ([x, y]) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    });
  }
  if (!Number.isFinite(minX)) return EMPTY; // κανένα vertex

  const span = Math.max(maxX - minX, maxY - minY);
  const s = span > MIN_SPAN ? ROBUST_SPAN / span : 1;
  const ox = minX;
  const oy = minY;

  const forward = ([x, y]: Pair): Pair => [(x - ox) * s, (y - oy) * s];
  const inverse = ([x, y]: Pair): Pair => [x / s + ox, y / s + oy];

  const scaled = geoms.map((g) => mapNode(g, forward) as ClipGeom);

  try {
    const out = op(scaled[0], ...scaled.slice(1));
    return mapNode(out, inverse) as MultiPolygon;
  } catch (err) {
    logger.error(`${opName} failed — graceful fallback σε κενό αποτέλεσμα`, {
      err,
      geomCount: geoms.length,
      span,
      scale: s,
    });
    return EMPTY;
  }
}

/**
 * Robust boolean **union** footprints. Σταθερό σε meter-scenes· ποτέ δεν πετάει
 * (geometry edge-case → κενή MultiPolygon + log αντί για crash του route).
 */
export function safeUnion(geom: ClipGeom, ...geoms: ClipGeom[]): MultiPolygon {
  return runScaled(polygonClipping.union, 'polygon union', [geom, ...geoms]);
}

/**
 * Robust boolean **intersection** footprints. Ίδιες εγγυήσεις με {@link safeUnion}.
 */
export function safeIntersection(geom: ClipGeom, ...geoms: ClipGeom[]): MultiPolygon {
  return runScaled(polygonClipping.intersection, 'polygon intersection', [geom, ...geoms]);
}
