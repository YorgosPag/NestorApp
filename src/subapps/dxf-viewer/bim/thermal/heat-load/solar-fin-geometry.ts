/**
 * ADR-422 L7.3 Slice D — Geometry-derived side-fin shading (PURE SSoT).
 *
 * **Κατοπτρικό του Slice B** (`solar-overhang-geometry`) στον **οριζόντιο-πλευρικό**
 * άξονα: ανίχνευση **κάθετου πτερυγίου** (fin / παραστάδα / πλευρική παρειά / κάθετος
 * τοίχος) δίπλα σε ένα εξωτ. παράθυρο και η γωνία πτερυγίου `β_fin`, για τον αυτόματο
 * συντελεστή σκίασης `F_fin` (EN ISO 13790 §11.4.4 `F_sh,gl = F_hor·F_ov·F_fin` /
 * ΤΟΤΕΕ 20701-1 πίν. πλευρικών πτερυγίων / Revit Energy «Shading»). Καθαρή γεωμετρία —
 * μηδέν scene/store/React:
 *
 *   - Στήνει τα **πλευρικά άκρα** του παραθύρου (`pos ± t·w/2`, `t` = εφαπτομένη όψης
 *     `(n.y,−n.x)` ⟂ outward normal) στο εξωτ. πρόσωπο (facade), και για **κάθε πλευρά**
 *     μετρά το **βάθος πτερυγίου** `d_fin` με την ΙΔΙΑ ray-cast του Slice B
 *     (`computeOverhangProjection`, στραμμένη 90° μέσω της lateral αρχής): η ακτίνα
 *     ξεκινά στο πλευρικό facade άκρο και βγαίνει κατά τον outward normal· η μέγιστη
 *     έξοδος από τα footprints των κάθετων τοίχων = `d_fin`. `d_fin = max(left, right)`.
 *   - `β_fin = atan(d_fin / w_ref)` (`computeOverhangAngleDeg`, ίδιος τύπος `atan(a/b)`),
 *     `w_ref` = πλάτος ανοίγματος. Ευθυγραμμισμένο/recessed πτερύγιο ⇒ `d_fin≈0` ⇒
 *     **zero-regression** (κανένα πτερύγιο, fallback στο manual `finShadingLevel` Slice C).
 *
 * **Μονάδες:** unit-agnostic — η γωνία είναι λόγος (οι μονάδες απλοποιούνται). Το
 * `outwardNormal`/`tangent` είναι **μοναδιαία**. REUSE-not-FORK (N.0.2): η ray-cast
 * μηχανή + η γωνία + ο interpolation pattern υπάρχουν — νέα είναι ΜΟΝΟ η lateral edge
 * geometry + ο angle-banded fin πίνακας (`FIN_GEOMETRY_SHADING_FACTOR`).
 *
 * @see ./solar-overhang-geometry (Slice B — το πρότυπο ray-cast/γωνία)
 * @see ./annual-gains-config (getFinGeometryShadingFactor — ο πίνακας F_fin)
 * @see ./space-boundary-resolver (per-window consumer)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L7.3 Slice D)
 */

import {
  computeOverhangAngleDeg,
  computeOverhangProjection,
  type OverhangOutline,
  type Point2DLike,
} from './solar-overhang-geometry';
import { azimuthToOrientation, getFinGeometryShadingFactor } from './annual-gains-config';

const DEG_TO_RAD = Math.PI / 180;
const MM_TO_M = 0.001;

/** Κάτω από αυτό το μήκος μια απόσταση θεωρείται μηδενική (degenerate). */
const FIN_PROJECTION_EPS = 1e-6;

/** Per-window inputs για το end-to-end `F_fin` (assembled από τον resolver). */
export interface WindowFinInput {
  /** Θέση κουφώματος στο όριο του χώρου (world XY, μονάδα σκηνής). */
  readonly openingPos: Point2DLike;
  /** Αζιμούθιο outward normal του παραθύρου (deg, 0°=Βορράς, clockwise). */
  readonly azimuthDeg: number;
  /** mm — πλάτος ανοίγματος κουφώματος (αναφορά `w_ref` της γωνίας πτερυγίου). */
  readonly openingWidthMm: number;
  /** mm — πάχος τοίχου-ξενιστή (offset προς το εξωτ. πρόσωπο). */
  readonly wallThicknessMm: number;
  /** Μέτρα ανά μονάδα σκηνής (`sceneUnitsToMeters`). */
  readonly sceneToM: number;
  /** Candidate footprints κάθετων τοίχων/πτερυγίων δίπλα στο παράθυρο. */
  readonly outlines: readonly OverhangOutline[];
}

/**
 * Βάθος πτερυγίου `d_fin` (ίδια μονάδα με τα inputs): το μέγιστο βάθος προβολής κάθετου
 * τοίχου ΠΕΡΑ από το facade, μετρημένο από **τα δύο** πλευρικά άκρα του παραθύρου
 * (`max(left, right)`). REUSE `computeOverhangProjection` ανά πλευρά — αλλάζει μόνο η
 * αρχή της ακτίνας (lateral edge αντί κέντρο). `0` αν κανένα πτερύγιο. Pure, idempotent.
 */
function computeFinProjection(
  openingPos: Point2DLike,
  normal: Point2DLike,
  tangent: Point2DLike,
  halfWidthScene: number,
  thicknessScene: number,
  outlines: readonly OverhangOutline[],
): number {
  let maxDist = 0;
  for (const side of [-1, 1] as const) {
    const facadePoint: Point2DLike = {
      x: openingPos.x + tangent.x * side * halfWidthScene + normal.x * thicknessScene,
      y: openingPos.y + tangent.y * side * halfWidthScene + normal.y * thicknessScene,
    };
    const dist = computeOverhangProjection({ facadePoint, outwardNormal: normal, outlines });
    if (dist > maxDist) maxDist = dist;
  }
  return maxDist;
}

/**
 * End-to-end συντελεστής σκίασης πλευρικού πτερυγίου `F_fin` ενός παραθύρου: στήνει τα
 * πλευρικά facade άκρα (`pos ± t·w/2`, offset κατά `n·thickness/2` στο εξωτ. πρόσωπο),
 * μετρά το βάθος πτερυγίου (ray-cast ανά πλευρά → `max`), τη γωνία `β_fin = atan(d_fin/
 * w_ref)` και κάνει lookup στον `FIN_GEOMETRY_SHADING_FACTOR`.
 *
 * Επιστρέφει `undefined` (⇒ το πεδίο μένει absent ⇒ **zero-regression** ⇒ fallback στο
 * manual `finShadingLevel` του Slice C) όταν: δεν υπάρχουν outlines, ο normal είναι
 * degenerate, ή το πτερύγιο δεν σκιάζει (`d_fin≤0` ή `β≤0`). Pure, idempotent.
 */
export function resolveWindowFinFactor(input: WindowFinInput): number | undefined {
  if (input.outlines.length === 0) return undefined;
  const azRad = input.azimuthDeg * DEG_TO_RAD;
  const normal: Point2DLike = { x: Math.sin(azRad), y: Math.cos(azRad) };
  if (Math.hypot(normal.x, normal.y) < FIN_PROJECTION_EPS) return undefined;
  // Εφαπτομένη όψης (lateral άξονας) = perpendicular του outward normal.
  const tangent: Point2DLike = { x: normal.y, y: -normal.x };
  const halfWidthScene = (input.openingWidthMm * 0.5 * MM_TO_M) / input.sceneToM;
  const thicknessScene = (input.wallThicknessMm * MM_TO_M) / input.sceneToM;
  const distScene = computeFinProjection(
    input.openingPos,
    normal,
    tangent,
    halfWidthScene,
    thicknessScene,
    input.outlines,
  );
  if (distScene <= FIN_PROJECTION_EPS) return undefined;
  const widthM = input.openingWidthMm * MM_TO_M;
  const angleDeg = computeOverhangAngleDeg({ projectionDist: distScene * input.sceneToM, height: widthM });
  if (angleDeg <= 0) return undefined;
  return getFinGeometryShadingFactor(angleDeg, azimuthToOrientation(input.azimuthDeg));
}
