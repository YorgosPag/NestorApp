/**
 * ADR-358 Phase 2b — Parallel offset μιας polyline στην προβολή xy.
 *
 * 🔑 **Η ΜΙΑ μηχανή offset** (ADR-791). Γενική στον τύπο σημείου: δέχεται ό,τι εκθέτει
 * x/y και **επιστρέφει τον ΙΔΙΟ τύπο** — 2Δ μέσα, 2Δ έξω· 3Δ μέσα, το z διατηρείται.
 *
 * Pure function (no DOM / React / DXF deps). Used by Phase 4a `StairGeometryService`
 * to derive stair stringers as constant-distance offsets of the walkline.
 *
 * Conventions:
 *   - 2D xy offset only. Το z αντιγράφεται αυτούσιο **όταν υπάρχει**· ΠΟΤΕ δεν
 *     κατασκευάζεται (ADR-789 — ένα `z: 0` που δεν υπήρχε είναι ψεύτικο υψόμετρο).
 *   - Positive `offsetDistance` = LEFT of travel direction (CCW perpendicular
 *     of segment direction). Negative = RIGHT.
 *   - Sharp interior corners that would explode the miter are clipped to a
 *     bevel using `miterLimit` (default 4 = standard SVG/CSS heuristic).
 *   - Closed polyline detection: `first ≈ last` within `CLOSE_EPS` (1e-9).
 *
 * Out-of-scope for Phase 2b (Clipper-class problems):
 *   - Self-intersection removal in concave regions
 *   - Hole / island handling
 *   - Non-planar (xyz) offset
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.3 §5.4
 */

/**
 * Ό,τι εκθέτει x/y (ADR-730/789). Η μηχανή offset δουλεύει στην **προβολή xy**, άρα
 * αυτό είναι όλο της το αίτημα από ένα σημείο.
 */
interface XY { readonly x: number; readonly y: number }

/**
 * Χτίζει σημείο εξόδου **του ΙΔΙΟΥ τύπου με την είσοδο** (ADR-789).
 *
 * ⚠️ Το `z` αντιγράφεται **μόνο αν υπάρχει**. Ένα `z: 0` που δεν υπήρχε στην είσοδο θα
 * ήταν **κατασκευασμένο** υψόμετρο — ακριβώς το ελάττωμα που ξερίζωσε το ADR-789 — και
 * ένα `z: undefined` θα έσπαγε το Firestore. Γι' αυτό ελέγχεται η **τιμή**, όχι το κλειδί.
 */
function like<P extends XY>(src: P, x: number, y: number): P {
  const z = (src as { readonly z?: number }).z;
  return (z === undefined ? { x, y } : { x, y, z }) as unknown as P;
}

const CLOSE_EPS = 1e-9;
const ANTIPARALLEL_EPS = 1e-9;
const DEFAULT_MITER_LIMIT = 4;

interface Vec2 { readonly x: number; readonly y: number; }

/** CCW perpendicular unit vector of (to - from) in xy plane. */
function perpUnit(from: XY, to: XY): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x: 0, y: 0 };
  return { x: -dy / len, y: dx / len };
}

/** True if two points coincide within `CLOSE_EPS` **στην προβολή xy** (η μηχανή είναι 2Δ). */
function pointsCoincide(a: XY, b: XY): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy) < CLOSE_EPS;
}

/** Emit the two bevel endpoints at an interior vertex (incoming + outgoing perp). */
function emitBevel<P extends XY>(
  out: P[],
  pivot: P,
  perpIn: Vec2,
  perpOut: Vec2,
  d: number,
): void {
  out.push(like(pivot, pivot.x + d * perpIn.x, pivot.y + d * perpIn.y));
  out.push(like(pivot, pivot.x + d * perpOut.x, pivot.y + d * perpOut.y));
}

/**
 * Emit either a single miter vertex or two bevel endpoints, depending on whether
 * the miter ratio exceeds `miterLimit` (or if the perpendiculars are antiparallel,
 * or the caller forced `'bevel'`).
 *
 * Miter formula: offset = pivot + d · (perpIn + perpOut) / (1 + perpIn·perpOut).
 * Derivation: projecting that offset onto either perpendicular yields exactly d,
 * which is the defining property of the miter join. |miter| / d = √(2 / (1 + dot)),
 * so the ratio explodes as the perpendiculars become antiparallel (≈180° turn).
 */
function emitJoin<P extends XY>(
  out: P[],
  pivot: P,
  perpIn: Vec2,
  perpOut: Vec2,
  d: number,
  join: 'miter' | 'bevel',
  miterLimit: number,
): void {
  const dot = perpIn.x * perpOut.x + perpIn.y * perpOut.y;
  const denom = 1 + dot;
  if (join === 'bevel' || denom < ANTIPARALLEL_EPS) {
    emitBevel(out, pivot, perpIn, perpOut, d);
    return;
  }
  const miterRatio = Math.sqrt(2 / denom);
  if (miterRatio > miterLimit) {
    emitBevel(out, pivot, perpIn, perpOut, d);
    return;
  }
  const scale = d / denom;
  out.push(like(pivot, pivot.x + scale * (perpIn.x + perpOut.x), pivot.y + scale * (perpIn.y + perpOut.y)));
}

/**
 * Parallel offset of a 3D polyline by `offsetDistance` in its xy projection.
 * z values are preserved per-vertex (input z copied to output verbatim).
 *
 * @param polyline       Input vertices (≥ 2; otherwise returns `[]`).
 * @param offsetDistance Signed distance: + = left of travel, − = right.
 * @param options.join   `'miter'` (default) or `'bevel'`. Miter falls back to
 *                       bevel when ratio > `miterLimit`.
 * @param options.miterLimit Miter cap (default 4). When |miter| > miterLimit · |d|
 *                           the join falls back to bevel.
 */
export function offsetPolyline<P extends XY>(
  polyline: readonly P[],
  offsetDistance: number,
  options?: {
    readonly join?: 'miter' | 'bevel';
    readonly miterLimit?: number;
    /**
     * Δηλωμένο κλείσιμο δακτυλίου. Όταν παραλείπεται, ανιχνεύεται από ταύτιση πρώτης/
     * τελευταίας κορυφής (`first ≈ last`) — η ιστορική σύμβαση, αμετάβλητη.
     *
     * ⚠️ `closed: true` **χωρίς** διπλή κορυφή είναι η σύμβαση των BIM δακτυλίων
     * (τοίχοι · κέλυφος · μόνωση): κάθε κορυφή, μαζί με την 0 και την n−1, παίρνει
     * join και από τις ΔΥΟ γειτονικές ακμές. Χωρίς αυτό ο δακτύλιος έχει ραφή.
     */
    readonly closed?: boolean;
  },
): readonly P[] {
  if (polyline.length < 2) return [];
  const join = options?.join ?? 'miter';
  const miterLimit = options?.miterLimit ?? DEFAULT_MITER_LIMIT;
  const n = polyline.length;
  // Η είσοδος «σφραγίζει» τον δακτύλιο επαναλαμβάνοντας την πρώτη κορυφή (σύμβαση
  // rendering/DXF)· οι BIM δακτύλιοι ΔΕΝ το κάνουν και δηλώνουν `closed: true`.
  const sealedInput = n >= 3 && pointsCoincide(polyline[0], polyline[n - 1]);
  const isClosed = options?.closed ?? sealedInput;
  // ⚠️ Το `-1` αφαιρεί τη ΣΦΡΑΓΙΔΑ (τη διπλή κορυφή), ΟΧΙ «επειδή είναι κλειστό»:
  // ένας δηλωμένος `closed: true` δακτύλιος χωρίς σφραγίδα έχει n ΜΟΝΑΔΙΚΕΣ κορυφές
  // και η αφαίρεση θα έτρωγε την τελευταία.
  const uniqueCount = sealedInput ? n - 1 : n;
  const segCount = isClosed ? uniqueCount : uniqueCount - 1;
  const perps: Vec2[] = new Array(segCount);
  for (let i = 0; i < segCount; i++) {
    const j = (i + 1) % uniqueCount;
    perps[i] = perpUnit(polyline[i], polyline[j]);
  }
  const out: P[] = [];
  for (let i = 0; i < uniqueCount; i++) {
    const pivot = polyline[i];
    const perpIn = isClosed ? perps[(i - 1 + segCount) % segCount] : (i === 0 ? null : perps[i - 1]);
    const perpOut = isClosed ? perps[i] : (i === segCount ? null : perps[i]);
    if (perpIn === null && perpOut !== null) {
      out.push(like(pivot, pivot.x + offsetDistance * perpOut.x, pivot.y + offsetDistance * perpOut.y));
    } else if (perpOut === null && perpIn !== null) {
      out.push(like(pivot, pivot.x + offsetDistance * perpIn.x, pivot.y + offsetDistance * perpIn.y));
    } else if (perpIn !== null && perpOut !== null) {
      emitJoin(out, pivot, perpIn, perpOut, offsetDistance, join, miterLimit);
    }
  }
  // ⚠️ Η σφραγίδα επιστρέφεται ΜΟΝΟ αν υπήρχε στην είσοδο. Ένας δηλωμένος
  // (`closed: true`) BIM δακτύλιος περιμένει n κορυφές για n κορυφές — προσθήκη
  // διπλής θα άλλαζε το πλήθος και θα έσπαγε κάθε index-aligned καταναλωτή.
  if (sealedInput && out.length > 0) {
    out.push({ ...out[0] });
  }
  return out;
}
