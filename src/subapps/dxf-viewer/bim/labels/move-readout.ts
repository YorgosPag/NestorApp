/**
 * Move-distance readout SSoT (ADR-363) — the ONE formatter + midpoint helper for the
 * live "how far did it move" annotation drawn during EVERY move gesture: the 2D Move
 * tool, a grip-drag / Alt-drag-from-point, and the 3D gizmo / opening drag.
 *
 * One place owns: (1) the displayed distance TEXT (`formatMoveDistance`), (2) the
 * scene-unit → metre conversion (`sceneDistanceToMeters`), and (3) the label/pill
 * anchor midpoint (`moveReadoutMid`). The 2D pill, the 3D line+label, and any future
 * readout therefore cannot visually diverge.
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
 * @see bim/labels/bim-dim-labels.ts — `drawDimPill` (the 2D pill the 2D readout reuses)
 */

import type { Point2D } from '../../rendering/types/Types';
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

/** Midpoint of two points — the readout pill / label anchor. Pure, allocation-light. */
export function moveReadoutMid(p1: Point2D, p2: Point2D): Point2D {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

/**
 * Locale-formatted angle (degrees) for the endpoint-reshape readout that sits next to the
 * angular-dimension arc. Wraps `formatAngleLocale` → degree symbol + locale separator, no
 * other hardcoded text (N.11-safe). Kept here so all readout number formatting is one SSoT.
 */
export function formatMoveAngle(angleDeg: number): string {
  return formatAngleLocale(angleDeg);
}
