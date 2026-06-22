/**
 * column-tilt-from-points — pure SSoT: «βάση→κορυφή κάτοψης» → `ColumnTilt`
 * (ADR-404 Phase 5, UX placement «Slanted Column», Revit-style).
 *
 * Η κεκλιμένη κολώνα ορίζεται με 2 κλικ: 1ο = βάση, 2ο = **πού πέφτει η κορυφή
 * στην κάτοψη**. Η οριζόντια απόσταση βάση→κορυφή ισούται με τη μετατόπιση του
 * shear του ADR-404 (`columnTiltShearAt`: κορυφή κατά `height·tan(angle)`), άρα η
 * **αντίστροφη** πράξη δίνει τη ΓΩΝΙΑ: `angle = atan(horizontalShift / height)`.
 * Η ΦΟΡΑ δεν είναι νέα — είναι ακριβώς η plan-direction βάση→σημείο που ήδη κατέχει
 * το `column-rotation` SSoT (atan2 + zoom-adaptive snap). Γι' αυτό αυτό το module
 * **δεν ξανα-υπολογίζει direction**: ο composer `resolveTopLeanTilt` το αντλεί από
 * τον `resolveColumnRotationDeg`. Έτσι το preview ≡ commit (ΕΝΑΣ composer, δύο call
 * sites) και η μόνη νέα μαθηματική πράξη είναι το `tiltAngleFromBaseTop`.
 *
 * **Unit-safety:** τα κλικ ζουν σε canvas/scene units, το ύψος σε mm. Ο λόγος
 * `shift/height` είναι αδιάστατος → μετατροπή scene→mm μέσω του SSoT `canvasToMmScaleFor`.
 *
 * @see bim/geometry/column-tilt.ts — `columnTiltShearAt` (η ευθεία πράξη, ADR-404 Φ1)
 * @see bim/columns/column-rotation.ts — `resolveColumnRotationDeg` (direction SSoT, ADR-508)
 * @see bim-3d/gizmo/bim3d-tilt-bridge.ts — `snapTiltAngleDeg` (γωνία snap SSoT, ADR-404 Φ2)
 * @see docs/centralized-systems/reference/adrs/ADR-404-3d-bim-element-tilt.md §Phase 5
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnTilt } from '../types/column-types';
import { canvasToMmScaleFor, type SceneUnits } from '../../utils/scene-units';
import { resolveColumnRotationDeg } from './column-rotation';
import { snapTiltAngleDeg } from '../../bim-3d/gizmo/bim3d-tilt-bridge';

/** Μέγιστη γωνία κλίσης (μοίρες) — αποτρέπει tan→∞ σε σχεδόν-οριζόντια τοποθέτηση. */
export const MAX_COLUMN_TILT_DEG = 80;

/**
 * Γωνία κλίσης (μοίρες από κατακόρυφο) από βάση→κορυφή στην κάτοψη — η **μόνη νέα**
 * μαθηματική πράξη: `atan(horizontalShiftMm / heightMm)`, clamped `[0, MAX_COLUMN_TILT_DEG]`.
 * Συμπίπτοντα σημεία ή μη-έγκυρο ύψος → 0 (κατακόρυφη, no-tilt fast-path).
 */
export function tiltAngleFromBaseTop(
  base: Readonly<Point2D>,
  top: Readonly<Point2D>,
  heightMm: number,
  sceneUnits: SceneUnits = 'mm',
): number {
  if (!(heightMm > 0)) return 0;
  const distScene = Math.hypot(top.x - base.x, top.y - base.y);
  if (distScene < 1e-9) return 0;
  const distMm = distScene * canvasToMmScaleFor({ sceneUnits });
  const rawAngleDeg = (Math.atan(distMm / heightMm) * 180) / Math.PI;
  return Math.min(rawAngleDeg, MAX_COLUMN_TILT_DEG);
}

/**
 * SSoT composer για την 2-κλικ τοποθέτηση: `{direction, angle}` με **και τα δύο
 * snapped** (preview ≡ commit by construction — καλείται ΚΑΙ από το `useColumnTool`
 * commit ΚΑΙ από το `column-preview-helpers` ghost). Reuse:
 *   - direction → `resolveColumnRotationDeg` (zoom-adaptive snap, ίδιο με rotation tool),
 *   - angle     → `snapTiltAngleDeg(tiltAngleFromBaseTop(...))` (5/15/30/45° magnetic).
 */
export function resolveTopLeanTilt(
  base: Readonly<Point2D>,
  cursor: Readonly<Point2D>,
  heightMm: number,
  sceneUnits: SceneUnits,
  worldPerPixel: number,
): ColumnTilt {
  return {
    direction: resolveColumnRotationDeg(base, cursor, worldPerPixel),
    angle: snapTiltAngleDeg(tiltAngleFromBaseTop(base, cursor, heightMm, sceneUnits)),
  };
}
