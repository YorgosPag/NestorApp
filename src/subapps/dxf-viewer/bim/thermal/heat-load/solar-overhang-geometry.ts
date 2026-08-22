/**
 * ADR-422 L7.3 Slice B — Geometry-derived overhang shading (PURE SSoT).
 *
 * Ανίχνευση **οριζόντιου προβόλου** (overhang) πάνω από ένα εξωτ. παράθυρο και η
 * γωνία προβόλου `β`, για τον αυτόματο συντελεστή σκίασης `F_ov` (EN ISO 13790
 * §11.4.4 / ΤΟΤΕΕ 20701-1 πίνακες προβόλων / Revit Energy «Shading»). Καθαρή
 * γεωμετρία — μηδέν scene/store/React:
 *
 *   - `computeOverhangProjection` — βάθος προβόλου `d_ov` (= πόσο προεξέχει η ακμή
 *     της πάνω-πλάκας ΠΕΡΑ από το εξωτ. πρόσωπο του τοίχου-ξενιστή, κατά μήκος του
 *     outward normal του παραθύρου) μέσω **ray-cast**: η ακτίνα ξεκινά στο εξωτ.
 *     πρόσωπο (facade) και βγαίνει προς τα έξω· η μέγιστη απόσταση εξόδου από τα
 *     overhang outlines = `d_ov`. Ευθυγραμμισμένοι όροφοι (slab edge ≈ facade) ⇒
 *     `d_ov ≈ 0` ⇒ **zero-regression** (κανένας πρόβολος).
 *   - `computeOverhangAngleDeg` — `β = atan(d_ov / h_top)` (clamp d_ov≤0 ή h_top≤ε → 0).
 *
 * **Μονάδες:** unit-agnostic — ο caller δίνει `facadePoint`/`outlines`/`height` στην
 * ΙΔΙΑ μονάδα (η γωνία είναι λόγος → οι μονάδες απλοποιούνται). Το `outwardNormal`
 * είναι **μοναδιαίο** διάνυσμα (ώστε το `t` του ray-cast = πραγματική απόσταση).
 *
 * Reuse: ο outward normal/azimuth παράγονται ήδη στο `polygon-azimuth-utils`
 * (L7.2) — εδώ ΜΟΝΟ η projection/γωνία (N.0.2, ΜΗΝ fork normal math).
 *
 * @see ./annual-gains-config (getOverhangShadingFactor — ο πίνακας F_ov)
 * @see ./space-boundary-resolver (per-window consumer)
 * @see ../../geometry/shared/polygon-azimuth-utils (azimuth → outward normal)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L7.3 Slice B)
 */

import { azimuthToOrientation, getOverhangShadingFactor } from './annual-gains-config';
import type { PlanarPoint } from '../../types/bim-base';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;
const MM_TO_M = 0.001;

/** Κάτω από αυτό το μήκος μια απόσταση/γωνία θεωρείται μηδενική (degenerate). */
const PROJECTION_EPS = 1e-6;

/** Ένας οριζόντιος πρόβολος (πλάκα/οροφή/μπαλκόνι) ως κλειστό πολύγωνο XY. */
export interface OverhangOutline {
  /** Closed polygon XY (world coords, μονάδα σκηνής). Min 3 κορυφές. */
  readonly polygonXY: readonly PlanarPoint[];
}

/** Παράμετροι του βάθους προβόλου `d_ov` (ray-cast από το facade προς τα έξω). */
export interface OverhangProjectionInput {
  /** Εξωτ. πρόσωπο τοίχου στη θέση του παραθύρου (αρχή της ακτίνας). */
  readonly facadePoint: PlanarPoint;
  /** **Μοναδιαίος** outward normal του παραθύρου (από `azimuthDeg`). */
  readonly outwardNormal: PlanarPoint;
  /** Τα candidate overhang outlines (πλάκες πάνω από το παράθυρο). */
  readonly outlines: readonly OverhangOutline[];
}

/**
 * Απόσταση εξόδου `t ≥ 0` της ακτίνας `F + t·n` από το ευθ. τμήμα `a→b`, ή `null`
 * αν δεν τέμνονται μπροστά από την αρχή (παράλληλα / `t<0` / `u∉[0,1]`). Το `n`
 * είναι μοναδιαίο ⇒ `t` = πραγματική απόσταση. Cramer επί `[n, −d]·[t,u]ᵀ = a−F`.
 */
function raySegmentExitDistance(
  f: PlanarPoint,
  n: PlanarPoint,
  a: PlanarPoint,
  b: PlanarPoint,
): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const det = dx * n.y - dy * n.x;
  if (Math.abs(det) < PROJECTION_EPS) return null; // παράλληλα
  const wx = a.x - f.x;
  const wy = a.y - f.y;
  const t = (dx * wy - dy * wx) / det;
  const u = (n.x * wy - n.y * wx) / det;
  if (t < 0 || u < -PROJECTION_EPS || u > 1 + PROJECTION_EPS) return null;
  return t;
}

/**
 * **Ο κοινός σκελετός** των δύο αναζητήσεων παρακάτω: διατρέχει κάθε ακμή κάθε outline,
 * ρωτά την **ΙΔΙΑ** `raySegmentExitDistance`, και διπλώνει τα χτυπήματα με τον `fold` του
 * καλούντος. Οι δύο συναρτήσεις διαφέρουν **μόνο** στο αρχικό στοιχείο και στο κριτήριο
 * επιλογής (max exit έναντι min θετικής τομής) — τα πάντα άλλα ήταν token-ταυτόσημα, και
 * το CHECK 3.28 (jscpd) το ανέφερε μόλις το αρχείο ξανα-αγγίχθηκε (ADR-792 Boy Scout).
 *
 * `0` επιστρέφεται από τους καλούντες όταν ο normal είναι degenerate — ο έλεγχος ζει εδώ,
 * ώστε να μην ξεχαστεί στον **τρίτο** καλούντα.
 */
function foldRayHits(
  input: OverhangProjectionInput,
  seed: number,
  fold: (best: number, hit: number) => number,
): number {
  const { facadePoint: f, outwardNormal: n, outlines } = input;
  if (Math.hypot(n.x, n.y) < PROJECTION_EPS) return 0;

  let best = seed;
  for (const outline of outlines) {
    const poly = outline.polygonXY;
    if (poly.length < 3) continue;
    for (let i = 0; i < poly.length; i++) {
      const hit = raySegmentExitDistance(f, n, poly[i], poly[(i + 1) % poly.length]);
      if (hit !== null) best = fold(best, hit);
    }
  }
  return best;
}

/**
 * Βάθος προβόλου `d_ov` (ίδια μονάδα με τα inputs): η μέγιστη απόσταση κατά μήκος
 * του outward normal που η ακτίνα από το facade διασχίζει κάποιο overhang outline.
 * `0` αν δεν υπάρχει πρόβολος ή ο normal είναι degenerate. Idempotent.
 */
export function computeOverhangProjection(input: OverhangProjectionInput): number {
  return foldRayHits(input, 0, (best, d) => (d > best ? d : best));
}

/**
 * **Πλησιέστερη** απόσταση `d ≥ 0` που η ακτίνα από το facade τέμνει κάποιο outline
 * (ελάχιστη θετική τομή, αντί της μέγιστης). 0 αν δεν υπάρχει τομή ή ο normal είναι
 * degenerate. Σε αντίθεση με το {@link computeOverhangProjection} (max exit = βάθος
 * προβόλου/πτερυγίου, Slice B/D), το **silhouette / κοντινή παρειά** είναι το σωστό
 * μέγεθος για τη γωνία ανύψωσης ορίζοντα (Slice E): η κοντινότερη μάζα υποτείνει τη
 * μεγαλύτερη γωνία. REUSE της ΙΔΙΑΣ `raySegmentExitDistance` — μηδέν νέα ray math.
 * Idempotent.
 */
export function computeNearestObstacleDistance(input: OverhangProjectionInput): number {
  const nearest = foldRayHits(input, Infinity, (best, d) => (d >= 0 && d < best ? d : best));
  return Number.isFinite(nearest) ? nearest : 0;
}

/** Παράμετροι της γωνίας προβόλου `β` (ίδια μονάδα για `d_ov` και `height`). */
export interface OverhangAngleInput {
  /** Βάθος προβόλου `d_ov` (από {@link computeOverhangProjection}). */
  readonly projectionDist: number;
  /** Κατακόρυφη απόσταση `h_top` άνω χείλους παραθύρου → κάτω παρειά προβόλου. */
  readonly height: number;
}

/**
 * Γωνία προβόλου `β = atan(d_ov / h_top)` σε μοίρες. `0` όταν δεν υπάρχει πρόβολος
 * (`d_ov ≤ ε`) ή το ύψος είναι μη-θετικό (`h_top ≤ ε` — παράθυρο στην παρειά του
 * προβόλου). Pure, idempotent — οι μονάδες απλοποιούνται στον λόγο.
 */
export function computeOverhangAngleDeg(input: OverhangAngleInput): number {
  const { projectionDist, height } = input;
  if (projectionDist <= PROJECTION_EPS || height <= PROJECTION_EPS) return 0;
  return Math.atan(projectionDist / height) * RAD_TO_DEG;
}

/** Per-window inputs για το end-to-end `F_ov` (assembled από τον resolver). */
export interface WindowOverhangInput {
  /** Θέση κουφώματος στο όριο του χώρου (world XY, μονάδα σκηνής). */
  readonly openingPos: PlanarPoint;
  /** Αζιμούθιο outward normal του παραθύρου (deg, 0°=Βορράς, clockwise). */
  readonly azimuthDeg: number;
  /** mm — ύψος ποδιάς πάνω από το δάπεδο. */
  readonly sillHeightMm: number;
  /** mm — καθαρό άνοιγμα κουφώματος (ποδιά→ανωκάσι). */
  readonly openingHeightMm: number;
  /** mm — καθαρό ύψος χώρου (≈ κάτω παρειά της πάνω-πλάκας/προβόλου). */
  readonly ceilingHeightMm: number;
  /** mm — πάχος τοίχου-ξενιστή (offset προς το εξωτ. πρόσωπο). */
  readonly wallThicknessMm: number;
  /** Μέτρα ανά μονάδα σκηνής (`sceneUnitsToMeters`). */
  readonly sceneToM: number;
  /** Candidate overhang outlines (πλάκες/μπαλκόνια πάνω από το παράθυρο). */
  readonly outlines: readonly OverhangOutline[];
}

/**
 * End-to-end συντελεστής σκίασης προβόλου `F_ov` ενός παραθύρου: στήνει το facade
 * point (opening pos + outward normal · πάχος τοίχου → εξωτ. πρόσωπο), μετρά το
 * βάθος προβόλου (ray-cast), τη γωνία `β` και κάνει lookup στον `OVERHANG_SHADING_FACTOR`.
 *
 * Επιστρέφει `undefined` (⇒ το πεδίο μένει absent ⇒ **zero-regression**) όταν: δεν
 * υπάρχουν outlines, ο normal είναι degenerate, ή ο πρόβολος δεν σκιάζει (`d_ov≤0`
 * ή `β≤0`). Pure, idempotent.
 */
export function resolveWindowOverhangFactor(input: WindowOverhangInput): number | undefined {
  if (input.outlines.length === 0) return undefined;
  const azRad = input.azimuthDeg * DEG_TO_RAD;
  const normal: PlanarPoint = { x: Math.sin(azRad), y: Math.cos(azRad) };
  const thicknessScene = (input.wallThicknessMm * MM_TO_M) / input.sceneToM;
  const facadePoint: PlanarPoint = {
    x: input.openingPos.x + normal.x * thicknessScene,
    y: input.openingPos.y + normal.y * thicknessScene,
  };
  const distScene = computeOverhangProjection({ facadePoint, outwardNormal: normal, outlines: input.outlines });
  if (distScene <= PROJECTION_EPS) return undefined;
  const heightM = (input.ceilingHeightMm - input.sillHeightMm - input.openingHeightMm) * MM_TO_M;
  const angleDeg = computeOverhangAngleDeg({ projectionDist: distScene * input.sceneToM, height: heightM });
  if (angleDeg <= 0) return undefined;
  return getOverhangShadingFactor(angleDeg, azimuthToOrientation(input.azimuthDeg));
}
