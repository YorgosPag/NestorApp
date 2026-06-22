/**
 * Wall tilt SSoT (ADR-404 — battered wall).
 *
 * Καθιερώνει την **κανονική ερμηνεία** του κεκλιμένου τοίχου ως **shear**: η βάση
 * μένει στη θέση της και η κορυφή γέρνει **κάθετα στη φορά** `start → end` κατά
 * `height · tan(angle)`. Ένας DOF — ακριβώς Revit «Angle From Vertical». Το πρόσημο
 * της `angle` επιλέγει σε ποια πλευρά (αριστερή/δεξιά κάθετη) γέρνει. Το ύψος μένει
 * αμετάβλητο (ADR-369). ΟΧΙ quaternion — διατηρεί κάτοψη/τομές/BOQ.
 *
 * Καταναλωτές: το 3D shear (`applyWallTilt`, `BimToThreeConverter`) και — από
 * ADR-404 Phase 3 — η 2Δ προβολή στο cut plane (`computeWallGeometry`) + η τομή.
 *
 * **Unit-safety:** η μετατόπιση = `heightAboveBase · tan(angle) · perpUnit`. Ο
 * `tan(angle)` είναι **αδιάστατος** και το `perpUnit` μοναδιαίο, οπότε το `dx`/`dy`
 * βγαίνει στην **ΙΔΙΑ μονάδα μήκους** με το `heightAboveBase` (αδιάφορο αν τα
 * `start`/`end` είναι σε mm ή canvas units — όπως το `beam-slope.ts`).
 *
 * @see column-tilt.ts — αδελφό SSoT (raking column)
 * @see docs/centralized-systems/reference/adrs/ADR-404-3d-bim-element-tilt.md
 */

import type { WallParams, WallTilt } from '../types/wall-types';
import type { PlanShift } from './column-tilt';

const DEG_TO_RAD = Math.PI / 180;
const LEN_EPS = 1e-9;

const NO_SHIFT: PlanShift = { dx: 0, dy: 0 };

/**
 * `true` όταν ένα `WallTilt` εκφράζει **ενεργή** κλίση (μη-μηδενική γωνία). SSoT
 * για το «τι σημαίνει κεκλιμένος» — καταναλώνεται ΚΑΙ από το `isWallTilted` (params
 * level) ΚΑΙ από το ribbon (`wall-tilt-param`, που δουλεύει σε `WallTilt | undefined`
 * — selected + drawing-mode overrides). Μηδέν διπλή σύγκριση.
 */
export function isWallTiltAngleActive(tilt: WallTilt | undefined): boolean {
  return tilt !== undefined && tilt.angle !== 0;
}

/** `true` όταν ο τοίχος είναι **κεκλιμένος** (έχει `tilt` με μη-μηδενική γωνία). */
export function isWallTilted(params: WallParams): boolean {
  return isWallTiltAngleActive(params.tilt);
}

/**
 * Plan-space μετατόπιση (⟂ στη run) στο ύψος `heightAboveBase`. Στη βάση → μηδέν.
 * Flat / εκφυλισμένος άξονας → μηδέν.
 */
export function wallTiltShearAt(params: WallParams, heightAboveBase: number): PlanShift {
  const tilt = params.tilt;
  if (tilt === undefined || tilt.angle === 0) return NO_SHIFT;
  const ax = params.end.x - params.start.x;
  const ay = params.end.y - params.start.y;
  const len = Math.hypot(ax, ay);
  if (len < LEN_EPS) return NO_SHIFT;
  // Αριστερή κάθετη της φοράς start→end· το πρόσημο της angle αντιστρέφει την πλευρά.
  const px = -ay / len;
  const py = ax / len;
  const mag = heightAboveBase * Math.tan(tilt.angle * DEG_TO_RAD);
  return { dx: mag * px, dy: mag * py };
}
