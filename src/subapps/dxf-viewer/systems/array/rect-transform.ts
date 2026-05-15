/**
 * ADR-353 SSOT — Rectangular array transform math.
 *
 * Produces an ordered list of ItemTransforms (row-major) for all cells.
 * Cell (0,0) = item[0] = identity transform (source position).
 *
 * Formula (AutoCAD convention):
 *   pos(r,c) = base + c·colSpacing·colDir + r·rowSpacing·rowDir
 *
 * colDir = (cos α, sin α)  — rotated by arrayAngle
 * rowDir = (-sin α, cos α) — perpendicular CCW
 */

import type { RectParams, ItemTransform, SourceBbox } from './types';
import { degToRad } from '../../rendering/entities/shared/geometry-utils';

/**
 * Compute per-item transforms for a rectangular array.
 *
 * @param params    - Validated RectParams (rows ≥ 1, cols ≥ 1, spacing ≠ 0)
 * @param sourceBbox - Bounding box of the source group (center = base point)
 * @returns Row-major list of ItemTransform: index = row * cols + col
 */
export function computeRectTransforms(
  params: RectParams,
  sourceBbox: SourceBbox,
): ItemTransform[] {
  const { rows, cols, rowSpacing, colSpacing, angle } = params;
  const rad = degToRad(angle);
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  // Column direction (rotated by angle)
  const colDirX = cosA;
  const colDirY = sinA;

  // Row direction (perpendicular CCW = (-sinA, cosA))
  const rowDirX = -sinA;
  const rowDirY = cosA;

  const base = sourceBbox.center;
  const result: ItemTransform[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tx = base.x + c * colSpacing * colDirX + r * rowSpacing * rowDirX;
      const ty = base.y + c * colSpacing * colDirY + r * rowSpacing * rowDirY;
      result.push({
        translateX: tx - base.x,
        translateY: ty - base.y,
        rotateDeg: 0,
      });
    }
  }

  return result;
}
