/**
 * ADR-183: Unified Grip System — Hit Testing
 *
 * Single hit-test function for ALL grips (DXF + overlay).
 * Vertex/center grips have priority over edge grips (Autodesk pattern).
 *
 * @see unified-grip-types.ts — type definitions
 * @see grip-registry.ts — grip computation
 */

import type { Point2D } from '../../rendering/types/Types';
import { squaredDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import type { UnifiedGripInfo } from './unified-grip-types';

/**
 * Find the nearest grip to a world-space position.
 *
 * Priority: vertex/center grips checked first, then edge grips.
 * This matches AutoCAD behavior where vertex grips "win" in dense areas.
 *
 * @param worldPos - Mouse position in world coordinates
 * @param grips - All registered grips (from useGripRegistry)
 * @param tolerancePx - Hit tolerance in screen pixels
 * @param scale - Current view transform scale
 * @returns Nearest grip within tolerance, or null
 */
export function findNearestGrip(
  worldPos: Point2D,
  grips: ReadonlyArray<UnifiedGripInfo>,
  tolerancePx: number,
  scale: number,
): UnifiedGripInfo | null {
  if (grips.length === 0) return null;

  const toleranceWorld = tolerancePx / scale;
  const toleranceSq = toleranceWorld * toleranceWorld;

  // Pass 1: vertex/center grips (highest priority)
  let bestGrip: UnifiedGripInfo | null = null;
  let bestDistSq = toleranceSq;

  for (const grip of grips) {
    if (grip.type === 'edge') continue;
    const distSq = squaredDistance(worldPos, grip.position);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestGrip = grip;
    }
  }

  if (bestGrip) return bestGrip;

  // Pass 2: edge grips (lower priority)
  bestDistSq = toleranceSq;
  for (const grip of grips) {
    if (grip.type !== 'edge') continue;
    const distSq = squaredDistance(worldPos, grip.position);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestGrip = grip;
    }
  }

  return bestGrip;
}
