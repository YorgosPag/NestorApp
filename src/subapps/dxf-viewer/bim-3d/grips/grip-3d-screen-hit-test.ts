/**
 * grip-3d-screen-hit-test.ts — PURE screen-space nearest-grip hit-test for the 3D
 * reshape-grip overlay (ADR-535 Φ5).
 *
 * Φ5 retires the raycaster-vs-mesh hit-test (`grip-3d-hit-test.ts`) together with the
 * grip cubes: the grips are now a Canvas2D overlay, so picking is screen-space — exactly
 * how the 2D canvas picks (`GripInteractionDetector`). Each grip is projected to
 * canvas-local px through the SAME projector the overlay draws with, and the nearest one
 * inside the pixel pick radius wins.
 *
 * Pure — no THREE, no React, no store. Jest-friendly (deterministic given a projector).
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo } from '../../hooks/grip-types';

/**
 * Return the ARRAY index of the grip nearest to (`canvasX`, `canvasY`) within
 * `hitRadiusPx`, or null when none is close enough. `project` maps a grip's plan point to
 * canvas-local px (same projector as the overlay draw). Nearest-wins: every reshape grip
 * is an equal, discrete square (no priority), mirror of `testGrip3DHit`'s nearest rule.
 *
 * `accept` (optional) excludes a grip from the pick — used to skip OCCLUDED grips (ADR-535
 * Φ5), so a grip hidden behind geometry is neither drawn nor clickable.
 */
export function findGripAtScreen(
  grips: readonly GripInfo[],
  project: (p: Point2D) => Point2D,
  canvasX: number,
  canvasY: number,
  hitRadiusPx: number,
  accept?: (index: number) => boolean,
): number | null {
  let bestIndex: number | null = null;
  let bestDist = hitRadiusPx;
  for (let i = 0; i < grips.length; i++) {
    if (accept && !accept(i)) continue;
    const s = project(grips[i].position);
    const dist = Math.hypot(s.x - canvasX, s.y - canvasY);
    if (dist <= bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}
