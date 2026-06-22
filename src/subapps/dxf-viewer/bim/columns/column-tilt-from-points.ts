/**
 * column-tilt-from-points — pure SSoT για την παραγωγή `ColumnTilt` από δύο σημεία
 * κάτοψης (βάση → κορυφή), ADR-404 Phase 5 (UX placement «Slanted Column», Revit-style).
 *
 * Η κεκλιμένη κολώνα ορίζεται με 2 κλικ: το 1ο = βάση, το 2ο = **πού πέφτει η κορυφή
 * στην κάτοψη**. Η οριζόντια απόσταση βάση→κορυφή ισούται με τη μετατόπιση που κάνει ο
 * shear του ADR-404 (`columnTiltShearAt`: η κορυφή μετατοπίζεται κατά `height·tan(angle)`).
 * Άρα η **αντίστροφη** πράξη δίνει τη γωνία: `angle = atan(horizontalShift / height)`.
 * Αυτή η συνέπεια κρατά preview ≡ commit ≡ 3D shear (ένα μοναδικό μοντέλο κλίσης).
 *
 * **Unit-safety:** τα σημεία κλικ ζουν σε **canvas/scene units**, το ύψος σε **mm**. Ο
 * λόγος `horizontalShift / height` είναι αδιάστατος, οπότε μετατρέπουμε την οριζόντια
 * απόσταση scene→mm μέσω του SSoT `canvasToMmScaleFor` πριν τη διαίρεση με `heightMm`.
 *
 * @see bim/geometry/column-tilt.ts — `columnTiltShearAt` (η ευθεία πράξη, ADR-404 Φ1)
 * @see docs/centralized-systems/reference/adrs/ADR-404-3d-bim-element-tilt.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnTilt } from '../types/column-types';
import { canvasToMmScaleFor, type SceneUnits } from '../../utils/scene-units';

/** Μέγιστη γωνία κλίσης (μοίρες) — αποτρέπει tan→∞ σε σχεδόν-οριζόντια τοποθέτηση. */
export const MAX_COLUMN_TILT_DEG = 80;

/** Κατακόρυφη (no-tilt) κολώνα. */
const NO_TILT: ColumnTilt = { direction: 0, angle: 0 };

/**
 * `ColumnTilt {direction, angle}` από βάση→κορυφή στην κάτοψη.
 *   - `direction` = `atan2(dy, dx)` (CCW μοίρες από +X) — η φορά που γέρνει η κορυφή.
 *   - `angle`     = `atan(horizontalShiftMm / heightMm)` (μοίρες από την κατακόρυφο),
 *                   clamped στο `[0, MAX_COLUMN_TILT_DEG]`.
 * Συμπίπτοντα σημεία ή μη-έγκυρο ύψος → `{direction:0, angle:0}` (flat fast-path).
 */
export function tiltFromBaseTop(
  base: Readonly<Point2D>,
  top: Readonly<Point2D>,
  heightMm: number,
  sceneUnits: SceneUnits = 'mm',
): ColumnTilt {
  if (!(heightMm > 0)) return NO_TILT;
  const dx = top.x - base.x;
  const dy = top.y - base.y;
  const distScene = Math.hypot(dx, dy);
  if (distScene < 1e-9) return NO_TILT;

  const distMm = distScene * canvasToMmScaleFor({ sceneUnits });
  const rawAngleDeg = (Math.atan(distMm / heightMm) * 180) / Math.PI;
  const angle = Math.min(rawAngleDeg, MAX_COLUMN_TILT_DEG);
  const direction = (Math.atan2(dy, dx) * 180) / Math.PI;
  return { direction, angle };
}
