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
 * The number goes through the locale-aware distance formatter SSoT
 * (`formatDistanceLocale`) so there is NO hardcoded unit string (N.11-safe) and the
 * decimal separator follows the user locale (1,23 in el-GR / 1.23 in en-US).
 *
 * Pure module: zero React / stores / DOM (ADR-040 micro-leaf safe; no per-frame
 * allocation beyond the small midpoint object).
 *
 * @see rendering/entities/shared/distance-label-utils.ts — distance formatter SSoT
 * @see bim/labels/bim-dim-labels.ts — `drawDimPill` (the 2D pill the 2D readout reuses)
 */

import type { Point2D } from '../../rendering/types/Types';
import { formatDistanceLocale, formatAngleLocale } from '../../rendering/entities/shared/distance-label-utils';
import { sceneUnitsToMeters, type SceneUnits } from '../../utils/scene-units';

/** Decimal places for the live move readout (metre scale → Revit-grade 2 dp). */
const MOVE_READOUT_DECIMALS = 2;

/**
 * Locale-formatted move distance for a displacement of `meters`. Wraps the distance
 * formatter SSoT → no hardcoded unit, locale-correct decimal separator. Identical
 * string in 2D & 3D. `Math.abs` guards a (theoretical) negative input.
 */
export function formatMoveDistance(meters: number): string {
  return formatDistanceLocale(Math.abs(meters), MOVE_READOUT_DECIMALS);
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
