/**
 * Move-distance readout SSoT (ADR-363) — the ONE distance/angle formatter for the live
 * "how far did it move" annotation. After ADR-560 (Giorgio 2026-07-04 «καμία πινακίδα»)
 * the 2D move flows show cyan alignment traces instead of a pill, so the only remaining
 * consumer is the 3D gizmo / opening-drag readout (`TempMoveReadoutOverlay`).
 *
 * One place owns: (1) the displayed distance TEXT (`formatMoveDistance`) and (2) the
 * scene-unit → metre conversion (`sceneDistanceToMeters`), so 2D & 3D cannot diverge.
 *
 * The number goes through the display-length formatter SSoT (`formatLengthMm`),
 * so it follows the status-bar unit selector (m / cm / mm / …) in real time and
 * the locale decimal separator (1,23 in el-GR / 1.23 in en-US). Internal geometry
 * stays canonical mm (ADR-462) — only the displayed string changes.
 *
 * Pure module: zero React / stores / DOM (ADR-040 micro-leaf safe; no per-frame
 * allocation beyond the small midpoint object).
 *
 * @see rendering/entities/shared/distance-label-utils.ts — distance formatter SSoT
 */

import { formatAngleLocale } from '../../rendering/entities/shared/distance-label-utils';
import { formatLengthMm } from '../../config/display-length-format';
import { sceneUnitsToMeters, type SceneUnits } from '../../utils/scene-units';

/**
 * Move distance for a displacement of `meters`, formatted in the user-selected
 * display unit (status-bar selector) with locale-correct separator + unit label.
 * Routes through the display-length SSoT (`formatLengthMm`, which works in mm) →
 * identical string in 2D & 3D. `Math.abs` guards a (theoretical) negative input.
 */
export function formatMoveDistance(meters: number): string {
  return formatLengthMm(Math.abs(meters) * 1000);
}

/**
 * Convert a distance expressed in the 2D scene's drawing units into metres (the unit
 * the readout displays). The 3D paths already work in world metres and skip this.
 * `valueScene * sceneUnitsToMeters(units)` per the scene-units SSoT.
 */
export function sceneDistanceToMeters(distanceSceneUnits: number, units: SceneUnits): number {
  return distanceSceneUnits * sceneUnitsToMeters(units);
}

/**
 * Locale-formatted angle (degrees) for the endpoint-reshape readout that sits next to the
 * angular-dimension arc. Wraps `formatAngleLocale` → degree symbol + locale separator, no
 * other hardcoded text (N.11-safe). Kept here so all readout number formatting is one SSoT.
 */
export function formatMoveAngle(angleDeg: number): string {
  return formatAngleLocale(angleDeg);
}
