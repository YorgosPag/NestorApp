/**
 * ADR-455 — 2D plan-side classification for the vertical section cuts (X/Y).
 *
 * In the 2D plan the X/Y cut does NOT hide the cut-away side (unlike the horizontal
 * cut's skip gate); instead that side renders as a GHOST (reduced alpha) so the user
 * still sees what is being sectioned out (Giorgio: «αυτό που κόβεται να είναι
 * φάντασμα»). This SSoT maps an entity's plan bbox (scene/canvas units, the same
 * space as `position`) to a ghost alpha multiplier.
 *
 * An entity is ghosted ⇔ it lies ENTIRELY on the cut-away side of an active cut
 * (the side opposite the viewing arrow). Entities straddling the plane stay solid
 * (part of them is on the kept side, mirroring the 3D clip showing a cross-section).
 * With both axes active, ghosting wins if the entity is fully cut-away on EITHER —
 * matching the 3D intersection-of-kept-half-spaces.
 *
 * Pure + side-effect-free so it is safe to call inside the per-entity render path.
 */

import type { AxisCutSetting } from '../../config/bim-render-settings-types';

/** Ghost alpha for the cut-away side — clearly subordinate, still legible. */
export const AXIS_CUT_GHOST_ALPHA = 0.18;

/** Entity plan bbox in scene/canvas units (same space as `AxisCutSetting.position`). */
export interface PlanBBox {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** True when a single active cut is given (saves a bbox compute when both are off). */
export function anyAxisCutActive(
  xCut: AxisCutSetting | null | undefined,
  yCut: AxisCutSetting | null | undefined,
): boolean {
  return Boolean(xCut?.active || yCut?.active);
}

/** Entity entirely on the cut-away side of one axis cut (⇒ ghost). */
function isFullyCutAway(min: number, max: number, cut: AxisCutSetting | null | undefined): boolean {
  if (!cut?.active) return false;
  // sign +1 keeps the lower-coordinate side solid → ghost when fully above `position`.
  // sign −1 keeps the higher-coordinate side solid → ghost when fully below `position`.
  return cut.sign === 1 ? min >= cut.position : max <= cut.position;
}

/**
 * Ghost alpha multiplier for an entity: {@link AXIS_CUT_GHOST_ALPHA} when it is fully
 * on the cut-away side of any active cut, else `1` (drawn normally).
 */
export function axisCutGhostFactor(
  bbox: PlanBBox,
  xCut: AxisCutSetting | null | undefined,
  yCut: AxisCutSetting | null | undefined,
): number {
  if (isFullyCutAway(bbox.minX, bbox.maxX, xCut)) return AXIS_CUT_GHOST_ALPHA;
  if (isFullyCutAway(bbox.minY, bbox.maxY, yCut)) return AXIS_CUT_GHOST_ALPHA;
  return 1;
}
