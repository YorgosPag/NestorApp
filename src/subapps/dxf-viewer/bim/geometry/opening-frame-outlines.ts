/**
 * Opening κάσα frame-jamb outlines (ADR-611) — 2D PLAN geometry SSoT.
 *
 * Builds the constant-cross-section frame member rectangles a placed opening
 * shows in plan view. Split out of `opening-geometry.ts` to keep that file under
 * the 500-line budget while staying in the same geometry domain (consumed only by
 * `computeOpeningGeometry`). Pure + side-effect free; world coords, z = 0.
 *
 * ─── SWEPT-PROFILE INVARIANT ─────────────────────────────────────────────────
 * `faceWidth` (extent ALONG the wall axis) and `depth` (through-thickness extent,
 * centred on the axis) are the two constant cross-section dimensions of the κάσα.
 * BOTH stay CONSTANT regardless of the opening's width/height and INDEPENDENT of
 * the host wall thickness (Revit swept-profile = Cinema4D constant cross-section).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-611-opening-frame-profile.md
 * @see bim/geometry/opening-geometry.ts — sole consumer
 */

import type { Polygon3D } from '../types/bim-base';

/** Minimal 2D point contract (the axis endpoints handed by the caller). */
interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/**
 * Build the TWO constant-cross-section κάσα jamb rectangles (PLAN view), one at
 * each end of the opening along the wall axis.
 *
 * @param startAxis      opening start point on the wall axis (scene units).
 * @param endAxis        opening end point on the wall axis (scene units).
 * @param ux,uy          wall-axis unit direction (start → end).
 * @param px,py          perpendicular unit direction (−side → +side).
 * @param faceWidthScene jamb extent ALONG the axis (visible κάσα width, scene units).
 * @param depthScene     through-thickness extent, centred on the axis (scene units).
 * @returns `[startJamb, endJamb]` — each a 4-vertex rectangle ordered
 *          `[start−perp, end−perp, end+perp, start+perp]` (same winding as the
 *          cutout outline), so all downstream consumers stay uniform.
 */
export function buildFrameJambOutlines(
  startAxis: Vec2,
  endAxis: Vec2,
  ux: number,
  uy: number,
  px: number,
  py: number,
  faceWidthScene: number,
  depthScene: number,
): Polygon3D[] {
  const halfDepth = depthScene / 2;
  const rect = (a: Vec2, b: Vec2): Polygon3D => ({
    vertices: [
      { x: a.x - px * halfDepth, y: a.y - py * halfDepth, z: 0 },
      { x: b.x - px * halfDepth, y: b.y - py * halfDepth, z: 0 },
      { x: b.x + px * halfDepth, y: b.y + py * halfDepth, z: 0 },
      { x: a.x + px * halfDepth, y: a.y + py * halfDepth, z: 0 },
    ],
  });
  const leftEnd: Vec2 = { x: startAxis.x + ux * faceWidthScene, y: startAxis.y + uy * faceWidthScene };
  const rightStart: Vec2 = { x: endAxis.x - ux * faceWidthScene, y: endAxis.y - uy * faceWidthScene };
  return [rect(startAxis, leftEnd), rect(rightStart, endAxis)];
}
