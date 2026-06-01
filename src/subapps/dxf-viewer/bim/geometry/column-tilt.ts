/**
 * Column tilt SSoT (ADR-404 — raking column).
 *
 * Καθιερώνει την **κανονική ερμηνεία** της κεκλιμένης κολώνας ως **shear**: η
 * βάση μένει στη θέση της και η κορυφή μετατοπίζεται στην κάτοψη κατά
 * `height · tan(angle)` προς την `direction`. Το ύψος/elevation της κολώνας
 * μένει αμετάβλητο (ADR-369) — ΟΧΙ rigid rotation που θα foreshorten-άρε το
 * ύψος, ΟΧΙ quaternion. Industry-aligned (Revit/Tekla «Slanted Column», angle/
 * direction-driven).
 *
 * Καταναλωτές: το 3D shear (`applyColumnTilt`, `BimToThreeConverter`) και — από
 * ADR-404 Phase 3 — η 2Δ προβολή στο cut plane (`computeColumnGeometry`) + η τομή.
 *
 * **Unit-safety:** η μετατόπιση = `heightAboveBase · tan(angle) · unit(direction)`.
 * Ο παράγοντας `tan(angle)` είναι **αδιάστατος**, οπότε το `dx`/`dy` βγαίνει στην
 * **ΙΔΙΑ μονάδα μήκους** με το `heightAboveBase` (world-metres στον 3D converter,
 * mm στο 2Δ) — όπως ακριβώς το axis-fraction στο `beam-slope.ts`.
 *
 * @see beam-slope.ts / slab-slope.ts — αδελφά slope SSoT (ADR-401)
 * @see docs/centralized-systems/reference/adrs/ADR-404-3d-bim-element-tilt.md
 */

import type { ColumnParams } from '../types/column-types';

const DEG_TO_RAD = Math.PI / 180;

/** Plan-space οριζόντια μετατόπιση (ίδια μονάδα με το `heightAboveBase`). */
export interface PlanShift {
  readonly dx: number;
  readonly dy: number;
}

/** Μηδενική μετατόπιση (flat fast-path). */
const NO_SHIFT: PlanShift = { dx: 0, dy: 0 };

/**
 * `true` όταν η κολώνα είναι **κεκλιμένη** (έχει `tilt` με μη-μηδενική γωνία).
 * Κεντρικό predicate — οι consumers επιλέγουν flat fast-path vs sheared path.
 */
export function isColumnTilted(params: ColumnParams): boolean {
  return params.tilt !== undefined && params.tilt.angle !== 0;
}

/**
 * Plan-space μετατόπιση στο ύψος `heightAboveBase` πάνω από τη βάση. Στη βάση
 * (`heightAboveBase = 0`) → μηδέν. Flat (μη-tilted) → μηδέν.
 */
export function columnTiltShearAt(params: ColumnParams, heightAboveBase: number): PlanShift {
  const tilt = params.tilt;
  if (tilt === undefined || tilt.angle === 0) return NO_SHIFT;
  const mag = heightAboveBase * Math.tan(tilt.angle * DEG_TO_RAD);
  const dirRad = tilt.direction * DEG_TO_RAD;
  return { dx: mag * Math.cos(dirRad), dy: mag * Math.sin(dirRad) };
}
