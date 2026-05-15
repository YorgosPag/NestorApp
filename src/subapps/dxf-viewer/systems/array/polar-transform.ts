/**
 * ADR-353 SSOT — Polar array transform math.
 *
 * Produces an ordered list of ItemTransforms for all items in a polar array.
 * Item[0] = identity transform (source stays at startAngle position).
 *
 * Divisor convention (AutoCAD-confirmed):
 *   - Full circle (|fillAngle| = 360°): divide by N → no duplicate at start=end
 *   - Partial arc              : divide by N-1 → both endpoints inclusive
 *   - Special case N=1         : single item at startAngle, no division
 *
 * When rotateItems=true, each item rotates around its own center (pos_i)
 * by i * angleStep degrees — matching the applyTransformToEntity pivot contract.
 */

import type { PolarParams, ItemTransform, SourceBbox } from './types';
import { degToRad } from '../../rendering/entities/shared/geometry-utils';

/**
 * Compute per-item transforms for a polar array.
 *
 * @param params     - Validated PolarParams (count ≥ 1, fillAngle ≠ 0)
 * @param sourceBbox - Bounding box of the source group (center = base point)
 * @returns Ordered list of ItemTransform, one per item (index 0 = startAngle)
 */
export function computePolarTransforms(
  params: PolarParams,
  sourceBbox: SourceBbox,
): ItemTransform[] {
  const { count, fillAngle, startAngle, rotateItems, center } = params;

  if (count <= 0) return [];

  // Radius: explicit override or auto-derived from source center → polar center
  const radius =
    params.radius > 0
      ? params.radius
      : Math.hypot(sourceBbox.center.x - center.x, sourceBbox.center.y - center.y);

  // Divisor: full circle → N (no duplicate), partial → N-1 (endpoints inclusive)
  const isFullCircle = Math.abs(fillAngle) === 360;
  const divisor = isFullCircle ? count : Math.max(count - 1, 1);
  const angleStep = fillAngle / divisor;

  const result: ItemTransform[] = [];

  for (let i = 0; i < count; i++) {
    const angleDeg = startAngle + i * angleStep;
    const angleRad = degToRad(angleDeg);

    const posX = center.x + radius * Math.cos(angleRad);
    const posY = center.y + radius * Math.sin(angleRad);

    result.push({
      translateX: posX - sourceBbox.center.x,
      translateY: posY - sourceBbox.center.y,
      // Rotation around pos_i (via applyTransformToEntity pivot contract)
      rotateDeg: rotateItems ? i * angleStep : 0,
    });
  }

  return result;
}
