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

/** Στρογγυλοποίηση σε ακέραιο grid (στον scaled χώρο ~1e4). */
function snapPair([x, y]: Pair): Pair {
  return [Math.round(x), Math.round(y)];
}

/**
 * Last-resort recovery για αποτυχίες της `polygon-clipping` σε N-way ops
 * («Unable to complete output ring» — εύθραυστος sweep-line με πολλά
 * σχεδόν-συνευθειακά/εφαπτόμενα edges, π.χ. 50 footprints τοίχων).
 *
 * Δύο τεχνικές, εφαρμόζονται ΜΟΝΟ αφού αποτύχει το happy-path op:
 *   1. **Snap σε ακέραιο grid** (scaled χώρος ~1e4 → 1 unit = 0.01% ≈ sub-mm
 *      φυσικά): εξαλείφει τα floating-point micro-segments που σπάνε τον
 *      sweep-line. Πρώτα δοκιμάζει ξανά το ΙΔΙΟ N-way op στο snapped grid.
 *   2. **Iterative left-fold**: `op(a,b,c) === op(op(a,b),c)` για
 *      union/intersection/difference, άρα ισοδύναμο αλλά πολύ πιο εύρωστο
 *      (κάθε βήμα = απλό 2-way op). Ένα μεμονωμένο geom που ακόμη πετάει
 *      παραλείπεται (graceful degradation αντί για κενό σύνολο).
 *
 * Επιστρέφει `null` μόνο αν ούτε το πρώτο geom δεν είναι αξιοποιήσιμο.
 */
function recoverScaled(
  op: ClipOp,
  scaled: readonly ClipGeom[],
): { out: MultiPolygon; skipped: number } | null {
  const snapped = scaled.map((g) => mapNode(g, snapPair) as ClipGeom);
  // A — ξαναδοκίμασε ολόκληρο το N-way op στο snapped grid.
  try {
    return { out: op(snapped[0], ...snapped.slice(1)), skipped: 0 };
  } catch {
    /* πέρασε στο iterative fold */
  }
  // B — iterative left-fold, παραλείποντας μεμονωμένα geoms που πετάνε.
  let acc: ClipGeom;
  try {
    acc = op(snapped[0]); // normalise το πρώτο geom σε MultiPolygon
  } catch {
    return null;
  }
  let skipped = 0;
  for (let i = 1; i < snapped.length; i++) {
    try {
      acc = op(acc, snapped[i]);
    } catch {
      skipped += 1; // ρίξε το μοναδικό προβληματικό operand
    }
  }
  return { out: acc as MultiPolygon, skipped };
}

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
    // N-way op απέτυχε → δοκίμασε recovery (snapped grid + iterative fold)
    // πριν παραιτηθούμε. Μόνο ολική αποτυχία πέφτει σε κενό αποτέλεσμα.
    const recovered = recoverScaled(op, scaled);
    if (recovered) {
      if (recovered.skipped > 0) {
        logger.warn(`${opName} N-way recovered via snapped iterative fold`, {
          geomCount: geoms.length,
          skipped: recovered.skipped,
          span,
          scale: s,
        });
      }
      return mapNode(recovered.out, inverse) as MultiPolygon;
    }
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

/**
 * Robust boolean **difference** (`geom` ΜΕΙΟΝ τα `geoms`). Ίδιες εγγυήσεις με
 * {@link safeUnion}. Χρήση: ADR-401 wall-top clip — η περιοχή του τοίχου **εκτός**
 * των host footprints (κορυφή = nominal), συμπληρωματική του `safeIntersection`.
 */
export function safeDifference(geom: ClipGeom, ...geoms: ClipGeom[]): MultiPolygon {
  return runScaled(polygonClipping.difference, 'polygon difference', [geom, ...geoms]);
}
