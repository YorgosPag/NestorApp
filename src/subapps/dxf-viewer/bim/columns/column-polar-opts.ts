/**
 * ADR-398 §3.13 — κεντρικό SSoT για τα `PolarDiskSnapOptions` του εργαλείου Κολώνα (Polar Magnet).
 *
 * **Thin wrapper** πάνω στο γενικευμένο `buildPlacementPolarSnapOptions` (ADR-514 Φ6d, κοινό SSoT με
 * το πέδιλο) — απλώς εξάγει τις διαστάσεις της κολώνας από τα user-editable overrides. Έτσι ghost
 * (`column-preview-helpers`) ΚΑΙ commit (`mouse-handler-up`) χτίζουν ΙΔΙΑ opts (preview ≡ commit), και
 * κολώνα ΚΑΙ πέδιλο μοιράζονται την ΙΔΙΑ magnet-opts λογική (μηδέν διπλότυπο).
 *
 * @see ../placement/placement-polar-opts.ts — το γενικευμένο SSoT (worldPerPixel + shiftFractions + clearance)
 * @see ./polar-disk-snap.ts — ο pure resolver που καταναλώνει αυτά τα opts
 */

import { DEFAULT_COLUMN_WIDTH_MM, DEFAULT_COLUMN_DEPTH_MM } from '../types/column-types';
import type { PolarDiskSnapOptions } from './polar-disk-snap';
import { buildPlacementPolarSnapOptions } from '../placement/placement-polar-opts';
import type { ColumnParamOverrides, SceneUnits } from '../../hooks/drawing/column-completion';

/** Χτίσε τα live `PolarDiskSnapOptions` από το user-editable column state + το τρέχον zoom. */
export function buildColumnPolarSnapOptions(
  overrides: Readonly<ColumnParamOverrides>,
  sceneUnits: SceneUnits,
): PolarDiskSnapOptions {
  const widthMm = typeof overrides.width === 'number' ? overrides.width : DEFAULT_COLUMN_WIDTH_MM;
  const depthMm = typeof overrides.depth === 'number' ? overrides.depth : DEFAULT_COLUMN_DEPTH_MM;
  return buildPlacementPolarSnapOptions(widthMm, depthMm, sceneUnits);
}
