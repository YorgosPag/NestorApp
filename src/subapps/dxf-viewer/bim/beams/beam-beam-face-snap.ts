/**
 * Beam→Beam face snap — pure SSoT (ADR-398 §Smart beam ghost / beam-to-beam framing).
 *
 * Αδελφό του `beam-column-face-snap` αλλά **axis-relative** (ΟΧΙ world-bbox): τα δοκάρια
 * είναι μακρόστενα & πιθανώς υπό γωνία, οπότε το ⊥/∥ κρίνεται από τον **άξονα** του
 * υφιστάμενου δοκαριού — όχι από axis-aligned bbox (handoff §3.4). Όταν το εργαλείο
 * «Δοκάρι» δείχνει το ghost-before-click κοντά σε **υφιστάμενο δοκάρι**:
 *
 *   · cursor πάνω στο **σώμα** (κατά μήκος) → 🟢 κάθετο Τ-framing στην **πλησιέστερη
 *     μακριά παρειά** (Β/Ν)· κέντρο άξονα → πλησιέστερη παρειά (απόφαση «Α»). Ολίσθηση
 *     σε όλο το μήκος (το `tAlong` ακολουθεί τον — ήδη snapped — cursor).
 *   · cursor **πέρα από κοντή άκρη** (Α/Δ) → 🔴 συγγραμμική συνέχεια («extend instead»).
 *
 * Reuse `projectPolygonOnAxis` (signed perp έκταση = οι δύο μακριές παρειές + οι κοντές
 * άκρες) + `projectPointOnAxis` (cursor along) — ΜΗΔΕΝ νέο projection primitive. Pure —
 * zero React/DOM/store. Μονάδες: **scene units** (axis/outline world-baked· ο caller δίνει
 * `ghostLenScene`/`captureScene`).
 *
 * @see ./beam-column-face-snap.ts — η column αδελφή + ο dispatcher (`resolveBeamGhostSnapFromStore`)
 * @see ../geometry/shared/polygon-axis-projection.ts — projectPolygonOnAxis/projectPointOnAxis (SSoT)
 * @see ../ghosts/ghost-status-color.ts — GhostStatus (🟢/🔴)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md
 */

import type { Point2D } from '../../rendering/types/Types';
import { projectPolygonOnAxis, projectPointOnAxis } from '../geometry/shared/polygon-axis-projection';
import type { GhostStatus } from '../ghosts/ghost-status-color';

/** Στόχος face-snap = υφιστάμενο δοκάρι (axis + outline, scene units). */
export interface BeamSnapTarget {
  readonly id: string;
  /** axisPolyline points (≥2). Ευθύ = 2· καμπύλο = tessellated (χρησιμοποιείται η χορδή). */
  readonly axis: readonly Point2D[];
  /** outline vertices (≥3) — δίνει τις μακριές παρειές + κοντές άκρες μέσω projection. */
  readonly outline: readonly Point2D[];
}

/** Αποτέλεσμα ghost snap: το centerline start/end + το σημασιολογικό status (🟢/🔴/ουδέτερο). */
export interface BeamGhostSnapResult {
  /** Centerline START (κλειδώνει το 1ο κλικ· πατά flush στην παρειά / κοντή άκρη). */
  readonly start: Point2D;
  /** Centerline END (μικρό ghost προς τα έξω — κάθετα στην παρειά ή συγγραμμικά στο άκρο). */
  readonly end: Point2D;
  /** 🟢 `beam` (κάθετο Τ-framing) / 🔴 `overlap` (συγγραμμικό κοντής άκρης) / `neutral`. */
  readonly status: GhostStatus;
}

export interface BeamBeamFaceSnapOptions {
  /** Μήκος μικρού φαντάσματος προς τα έξω από την παρειά/άκρη. */
  readonly ghostLenScene: number;
  /** Μέγιστη απόσταση cursor→σώμα δοκαριού για ενεργοποίηση. */
  readonly captureScene: number;
}

/** Πλαίσιο άξονα ενός υποψήφιου δοκαριού-στόχου (όλα σε scene units). */
interface TargetFrame {
  readonly a: Point2D; // axis origin (axis[0])
  readonly u: Point2D; // unit axis direction (chord)
  readonly p: Point2D; // unit perpendicular = (u.y, -u.x) — η φορά του signedPerp
  readonly alongMin: number;
  readonly alongMax: number;
  readonly perpMin: number;
  readonly perpMax: number;
  readonly cAlong: number; // cursor διαμήκης θέση
  readonly cPerp: number; // cursor signed κάθετη θέση
  readonly distance: number; // cursor → oriented band απόσταση (0 εντός σώματος)
}

/** Χτίζει το axis frame + προβολές cursor για έναν στόχο· `null` σε εκφυλισμένο άξονα. */
function buildTargetFrame(cursor: Readonly<Point2D>, target: BeamSnapTarget): TargetFrame | null {
  const pts = target.axis;
  const a = pts[0];
  const last = pts[pts.length - 1];
  const dx = last.x - a.x;
  const dy = last.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  const u: Point2D = { x: dx / len, y: dy / len };
  const p: Point2D = { x: u.y, y: -u.x };
  const poly = projectPolygonOnAxis(target.outline, a.x, a.y, u.x, u.y);
  const cAlong = projectPointOnAxis(cursor.x, cursor.y, a.x, a.y, u.x, u.y).along;
  const cPerp = (cursor.x - a.x) * u.y - (cursor.y - a.y) * u.x;
  const alongClamped = Math.min(Math.max(cAlong, poly.alongMin), poly.alongMax);
  const perpClamped = Math.min(Math.max(cPerp, poly.perpMin), poly.perpMax);
  const distance = Math.hypot(cAlong - alongClamped, cPerp - perpClamped);
  return {
    a: { x: a.x, y: a.y },
    u,
    p,
    alongMin: poly.alongMin,
    alongMax: poly.alongMax,
    perpMin: poly.perpMin,
    perpMax: poly.perpMax,
    cAlong,
    cPerp,
    distance,
  };
}

/**
 * Επιλέγει το ghost snap πάνω σε υφιστάμενο δοκάρι. Pure. `null` όταν κανένα δοκάρι δεν
 * είναι εντός `captureScene` (ελεύθερη κίνηση → ο caller δείχνει default ghost).
 */
export function resolveBeamBeamFaceSnap(
  cursor: Readonly<Point2D>,
  targets: readonly BeamSnapTarget[],
  opts: Readonly<BeamBeamFaceSnapOptions>,
): BeamGhostSnapResult | null {
  let best: TargetFrame | null = null;
  for (const t of targets) {
    if (t.axis.length < 2 || t.outline.length < 3) continue;
    const fr = buildTargetFrame(cursor, t);
    if (fr && fr.distance <= opts.captureScene && (!best || fr.distance < best.distance)) {
      best = fr;
    }
  }
  if (!best) return null;

  const { a, u, p, alongMin, alongMax, perpMin, perpMax, cAlong, cPerp } = best;
  const len = opts.ghostLenScene;
  const mid = (perpMin + perpMax) / 2;

  // ── cursor πάνω στο σώμα → 🟢 κάθετο Τ-framing στην πλησιέστερη μακριά παρειά ──────
  if (cAlong >= alongMin && cAlong <= alongMax) {
    const nearPerp = cPerp >= mid ? perpMax : perpMin; // πλησιέστερη παρειά (κέντρο→«Α»)
    const outwardSign = nearPerp >= mid ? 1 : -1; // μακριά από το κέντρο σώματος
    const tAlong = Math.min(Math.max(cAlong, alongMin), alongMax); // ολίσθηση κατά μήκος
    const start: Point2D = {
      x: a.x + tAlong * u.x + nearPerp * p.x,
      y: a.y + tAlong * u.y + nearPerp * p.y,
    };
    const end: Point2D = {
      x: start.x + outwardSign * len * p.x,
      y: start.y + outwardSign * len * p.y,
    };
    return { start, end, status: 'beam' };
  }

  // ── cursor πέρα από κοντή άκρη → 🔴 συγγραμμική συνέχεια («extend instead») ─────────
  const beyondStart = cAlong < alongMin;
  const tEnd = beyondStart ? alongMin : alongMax;
  const dir = beyondStart ? -1 : 1;
  const start: Point2D = {
    x: a.x + tEnd * u.x + mid * p.x,
    y: a.y + tEnd * u.y + mid * p.y,
  };
  const end: Point2D = {
    x: start.x + dir * len * u.x,
    y: start.y + dir * len * u.y,
  };
  return { start, end, status: 'overlap' };
}

/** Συνημίτονο ορίου «παράλληλων αξόνων» (≈ ±10°). |u₁·u₂| ≥ τιμή ⇒ παράλληλα. */
const PARALLEL_COS = 0.985;
/** Float-noise guard για το «ουσιαστική επικάλυψη κατά μήκος» (scene units). */
const OVERLAP_EPS = 1e-6;

/**
 * `true` αν το νέο δοκάρι (`start→end`, πλάτος `newWidthScene`) θα κείτεται **ομοαξονικά /
 * πάνω** σε υφιστάμενο δοκάρι — duplication, ΟΧΙ έγκυρο κάθετο Τ-framing. Κριτήρια (ΟΛΑ):
 *   1. **παράλληλοι** άξονες (`|u_new·u_target| ≥ PARALLEL_COS`),
 *   2. **ουσιαστική** επικάλυψη κατά μήκος του κοινού άξονα (`> OVERLAP_EPS` — όχι απλό
 *      άγγιγμα άκρο-με-άκρο, που είναι νόμιμη επέκταση),
 *   3. **κοντινές παρειές**: κάθετη απόσταση κέντρου νέου ≤ άθροισμα half-widths.
 *
 * Κάθετο Τ-framing (⊥) αποκλείεται από το (1). Παράλληλο δοκάρι **δίπλα** (offset > half-widths)
 * αποκλείεται από το (3). Reuse `projectPointOnAxis`/`projectPolygonOnAxis`. Pure (scene units).
 */
export function isBeamCollinearOverlap(
  start: Readonly<Point2D>,
  end: Readonly<Point2D>,
  newWidthScene: number,
  targets: readonly BeamSnapTarget[],
): boolean {
  const ndx = end.x - start.x;
  const ndy = end.y - start.y;
  const nlen = Math.hypot(ndx, ndy);
  if (nlen < 1e-9) return false;
  const nu: Point2D = { x: ndx / nlen, y: ndy / nlen };
  const newHalf = newWidthScene / 2;
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  for (const t of targets) {
    if (t.axis.length < 2 || t.outline.length < 3) continue;
    const a = t.axis[0];
    const b = t.axis[t.axis.length - 1];
    const tdx = b.x - a.x;
    const tdy = b.y - a.y;
    const tlen = Math.hypot(tdx, tdy);
    if (tlen < 1e-9) continue;
    const tu: Point2D = { x: tdx / tlen, y: tdy / tlen };

    // (1) παράλληλοι άξονες;
    if (Math.abs(nu.x * tu.x + nu.y * tu.y) < PARALLEL_COS) continue;

    // (2) ουσιαστική επικάλυψη κατά μήκος του άξονα-στόχου;
    const tp = projectPolygonOnAxis(t.outline, a.x, a.y, tu.x, tu.y);
    const sA = projectPointOnAxis(start.x, start.y, a.x, a.y, tu.x, tu.y).along;
    const eA = projectPointOnAxis(end.x, end.y, a.x, a.y, tu.x, tu.y).along;
    const overlapLen = Math.min(Math.max(sA, eA), tp.alongMax) - Math.max(Math.min(sA, eA), tp.alongMin);
    if (overlapLen <= OVERLAP_EPS) continue;

    // (3) κοντινές παρειές (κάθετη απόσταση κέντρου ≤ άθροισμα half-widths);
    const perp = projectPointOnAxis(midX, midY, a.x, a.y, tu.x, tu.y).perp;
    const targetHalf = Math.max(Math.abs(tp.perpMin), Math.abs(tp.perpMax));
    if (perp <= newHalf + targetHalf) return true;
  }
  return false;
}
