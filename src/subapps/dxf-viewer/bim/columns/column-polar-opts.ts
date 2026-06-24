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

import { DEFAULT_COLUMN_WIDTH_MM, DEFAULT_COLUMN_DEPTH_MM, type ColumnKind } from '../types/column-types';
import type { PolarDiskSnapOptions } from './polar-disk-snap';
import { buildPlacementPolarSnapOptions } from '../placement/placement-polar-opts';
import { mmToSceneUnits } from '../../utils/scene-units';
import type { ColumnParamOverrides, SceneUnits } from '../../hooks/drawing/column-completion';

/**
 * Χτίσε τα live `PolarDiskSnapOptions` από το user-editable column state + το τρέχον zoom.
 *
 * ADR-398 §3.19 — όταν `kind==='circular'`, προσθέτει `circleRadiusScene` (= διάμετρος/2 σε scene
 * units) ώστε ο resolver να παράγει circumference-tangent candidates (η περιφέρεια εφάπτεται σε
 * παρειά/άξονα). Gated: rect/polygon/I/L/T → `undefined` (μηδέν tangent, μηδέν regression). Καλείται
 * ΙΔΙΑ από ghost (`column-preview-helpers`) ΚΑΙ commit (`mouse-handler-up`) → preview ≡ commit.
 */
export function buildColumnPolarSnapOptions(
  overrides: Readonly<ColumnParamOverrides>,
  sceneUnits: SceneUnits,
  kind?: ColumnKind,
): PolarDiskSnapOptions {
  const widthMm = typeof overrides.width === 'number' ? overrides.width : DEFAULT_COLUMN_WIDTH_MM;
  const depthMm = typeof overrides.depth === 'number' ? overrides.depth : DEFAULT_COLUMN_DEPTH_MM;
  const base = buildPlacementPolarSnapOptions(widthMm, depthMm, sceneUnits);
  // §3.19 — κυκλική: width = διάμετρος → R = width/2 (ίδιο με `circularAnchorLocal`, ADR-519).
  return kind === 'circular'
    ? { ...base, circleRadiusScene: (widthMm / 2) * mmToSceneUnits(sceneUnits) }
    : base;
}
