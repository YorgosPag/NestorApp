/**
 * ADR-398 §3.13 — κεντρικό SSoT για τα `PolarDiskSnapOptions` του εργαλείου Κολώνα (Polar Magnet).
 *
 * Μαζεύει σε ΕΝΑ σημείο τα τρία inputs που χρειάζεται ο `resolvePolarDiskSnap`, ώστε ghost
 * (`column-preview-helpers`) ΚΑΙ commit (`mouse-handler-up`) να τα χτίζουν ΙΔΙΑ (preview ≡ commit):
 *   · `worldPerPixel` — zoom-adaptive ring/angle βήμα (από το live `ImmediateTransformStore`)·
 *   · `shiftFractions` — §3.13 Q1 (από το `ColumnPolarStore` interaction state)·
 *   · `clearanceScene` — Q5 edge clearance = cover + ημι-διαγώνιος κολώνας (από τα overrides).
 *
 * Μη-pure (διαβάζει live stores) — γι' αυτό ζει χωριστά από τον pure `polar-disk-snap`.
 *
 * @see ./polar-disk-snap.ts — ο pure resolver που καταναλώνει αυτά τα opts
 */

import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { getColumnPolarState } from '../../systems/cursor/ColumnPolarStore';
import { DEFAULT_COLUMN_WIDTH_MM, DEFAULT_COLUMN_DEPTH_MM } from '../types/column-types';
import { polarClearanceScene, type PolarDiskSnapOptions } from './polar-disk-snap';
import type { ColumnParamOverrides, SceneUnits } from '../../hooks/drawing/column-completion';

/** Χτίσε τα live `PolarDiskSnapOptions` από το user-editable column state + το τρέχον zoom. */
export function buildColumnPolarSnapOptions(
  overrides: Readonly<ColumnParamOverrides>,
  sceneUnits: SceneUnits,
): PolarDiskSnapOptions {
  const widthMm = typeof overrides.width === 'number' ? overrides.width : DEFAULT_COLUMN_WIDTH_MM;
  const depthMm = typeof overrides.depth === 'number' ? overrides.depth : DEFAULT_COLUMN_DEPTH_MM;
  return {
    worldPerPixel: worldPerPixel(getImmediateTransform().scale),
    shiftFractions: getColumnPolarState().shiftFractions,
    clearanceScene: polarClearanceScene(widthMm, depthMm, sceneUnits),
  };
}
