/**
 * ADR-422 L7.3 Slice E — Geometry-derived horizon shading (PURE SSoT).
 *
 * **Ολοκλήρωση του shading triad** (`F_sh,gl = obstruction · F_hor · F_ov · F_fin`,
 * EN ISO 13790 §11.4.4) — το **κατοπτρικό των Slice B/D στον ΚΑΤΑΚΟΡΥΦΟ-μακρινό
 * άξονα**: ανίχνευση **μακρινών γειτονικών μαζών** (όγκοι άλλων κτιρίων που υψώνονται
 * πάνω από τη γραμμή ορίζοντα μπροστά στο παράθυρο) και η γωνία ανύψωσης `α_hor`, για
 * τον αυτόματο συντελεστή σκίασης `F_hor` (Revit Energy «Site/Context Shading» /
 * 4M-FineHEAT / ΤΟΤΕΕ 20701-1). Καθαρή γεωμετρία — μηδέν scene/store/React:
 *
 *   - Από το **εξωτ. πρόσωπο** του παραθύρου (facade = `pos + n·thickness`), για
 *     **κάθε** γειτονική μάζα ray-cast **κατά τον outward normal** (όπως Slice B) →
 *     **πλησιέστερη** οριζόντια απόσταση `d_obs` (`computeNearestObstacleDistance` REUSE
 *     — κοντινή παρειά/silhouette, ΟΧΙ max-exit όπως ο πρόβολος· η κοντινή μάζα υποτείνει
 *     τη μεγαλύτερη γωνία).
 *   - `α_hor = atan(h_obs / d_obs)` (`computeOverhangAngleDeg` REUSE — `projectionDist`=
 *     `h_obs` το ύψος της μάζας **πάνω από** το άνοιγμα, `height`=`d_obs`), όπου
 *     `h_obs = obstacle.topElevationM − apertureElevationM` (απόλυτα ύψη site datum).
 *   - Κρατά τη **μέγιστη** `α_hor` σε όλες τις μάζες (ο ψηλότερος ορίζοντας κυριαρχεί)
 *     → lookup στον `HORIZON_GEOMETRY_SHADING_FACTOR`.
 *
 * **Μονάδες:** `d_obs` σε scene units → μέτρα (× `sceneToM`)· `h_obs` σε μέτρα ⇒ η
 * γωνία είναι λόγος (αδιάστατη). Το `outwardNormal` είναι **μοναδιαίο**. Καμία μάζα /
 * μάζα κάτω από το άνοιγμα / μηδενική απόσταση ⇒ `undefined` (⇒ fallback manual
 * `horizonShadingLevel` Slice C ⇒ **zero-regression**). REUSE-not-FORK (N.0.2): η
 * ray-cast μηχανή + η γωνία + ο interpolation pattern υπάρχουν — νέα είναι ΜΟΝΟ ο
 * angle-banded horizon πίνακας + το cross-building obstacle sourcing (ADR-369).
 *
 * @see ./solar-overhang-geometry (Slice B — η ray-cast μηχανή/γωνία)
 * @see ./solar-fin-geometry (Slice D — το πρότυπο precedence geometry>manual)
 * @see ./annual-gains-config (getHorizonGeometryShadingFactor — ο πίνακας F_hor)
 * @see ./site-placement-transform (ADR-369 — obstacle outlines στο active frame)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L7.3 Slice E)
 */

import {
  computeNearestObstacleDistance,
  computeOverhangAngleDeg,
  type Point2DLike,
} from './solar-overhang-geometry';
import { azimuthToOrientation, getHorizonGeometryShadingFactor } from './annual-gains-config';

const DEG_TO_RAD = Math.PI / 180;
const MM_TO_M = 0.001;

/** Κάτω από αυτό το μήκος/ύψος μια τιμή θεωρείται μηδενική (degenerate). */
const HORIZON_EPS = 1e-6;

/**
 * Μία γειτονική μάζα ως εμπόδιο ορίζοντα: footprint **στο frame του ενεργού κτιρίου**
 * (scene units, μέσω `site-placement-transform`) + απόλυτο ύψος κορυφής (site datum).
 */
export interface HorizonObstacle {
  /** Κλειστό footprint πολύγωνο XY στο **ενεργό** scene frame (scene units). */
  readonly polygonXY: readonly Point2DLike[];
  /** METRES — απόλυτο ύψος κορυφής της μάζας (site datum: `baseElevation` + ύψος). */
  readonly topElevationM: number;
}

/** Per-window inputs για το end-to-end `F_hor` (assembled από τον resolver). */
export interface WindowHorizonInput {
  /** Θέση κουφώματος στο όριο του χώρου (world XY, μονάδα ενεργής σκηνής). */
  readonly openingPos: Point2DLike;
  /** Αζιμούθιο outward normal του παραθύρου (deg, 0°=Βορράς, clockwise). */
  readonly azimuthDeg: number;
  /** mm — πάχος τοίχου-ξενιστή (offset προς το εξωτ. πρόσωπο). */
  readonly wallThicknessMm: number;
  /** Μέτρα ανά μονάδα ενεργής σκηνής (`sceneUnitsToMeters`). */
  readonly sceneToM: number;
  /** METRES — απόλυτο ύψος του ανοίγματος (site datum: floor base + ποδιά + μισό ύψος). */
  readonly apertureElevationM: number;
  /** Γειτονικές μάζες (footprints στο ενεργό frame + απόλυτο ύψος κορυφής). */
  readonly obstacles: readonly HorizonObstacle[];
}

/**
 * End-to-end συντελεστής σκίασης ορίζοντα `F_hor` ενός παραθύρου: στήνει το facade
 * point (opening pos + outward normal · πάχος τοίχου → εξωτ. πρόσωπο) και για **κάθε**
 * γειτονική μάζα μετρά την οριζόντια απόσταση `d_obs` (ray-cast) και τη γωνία ανύψωσης
 * `α_hor = atan(h_obs/d_obs)`· κρατά τη μέγιστη γωνία (ψηλότερος ορίζοντας) και κάνει
 * lookup στον `HORIZON_GEOMETRY_SHADING_FACTOR`.
 *
 * Επιστρέφει `undefined` (⇒ το πεδίο μένει absent ⇒ fallback manual `horizonShadingLevel`
 * Slice C ⇒ **zero-regression**) όταν: δεν υπάρχουν μάζες, ο normal είναι degenerate, ή
 * καμία μάζα δεν σκιάζει (όλες κάτω από το άνοιγμα / πίσω από το facade / `α≤0`). Pure.
 */
export function resolveWindowHorizonFactor(input: WindowHorizonInput): number | undefined {
  if (input.obstacles.length === 0) return undefined;
  const azRad = input.azimuthDeg * DEG_TO_RAD;
  const normal: Point2DLike = { x: Math.sin(azRad), y: Math.cos(azRad) };
  if (Math.hypot(normal.x, normal.y) < HORIZON_EPS) return undefined;
  const thicknessScene = (input.wallThicknessMm * MM_TO_M) / input.sceneToM;
  const facadePoint: Point2DLike = {
    x: input.openingPos.x + normal.x * thicknessScene,
    y: input.openingPos.y + normal.y * thicknessScene,
  };

  let maxAngleDeg = 0;
  for (const obstacle of input.obstacles) {
    const heightAboveM = obstacle.topElevationM - input.apertureElevationM;
    if (heightAboveM <= HORIZON_EPS) continue; // μάζα κάτω/στο ύψος του ανοίγματος
    const distScene = computeNearestObstacleDistance({
      facadePoint,
      outwardNormal: normal,
      outlines: [{ polygonXY: obstacle.polygonXY }],
    });
    if (distScene <= HORIZON_EPS) continue; // πίσω από το facade / καμία τομή
    const angleDeg = computeOverhangAngleDeg({
      projectionDist: heightAboveM,
      height: distScene * input.sceneToM,
    });
    if (angleDeg > maxAngleDeg) maxAngleDeg = angleDeg;
  }

  if (maxAngleDeg <= 0) return undefined;
  return getHorizonGeometryShadingFactor(maxAngleDeg, azimuthToOrientation(input.azimuthDeg));
}
