/**
 * 🏢 ENTERPRISE: DXF XLINE / RAY Converters
 *
 * Phase 8 (ADR-359) — Parse infinite construction lines (XLINE) and
 * semi-infinite rays (RAY) from DXF. Extracted from `dxf-entity-converters.ts`
 * to keep that file under the 500-line Google SRP limit.
 *
 * DXF Codes for both:
 *   10,20 = Base point
 *   11,21 = Direction vector (unit-normalized in scene)
 *
 * @see dxf-entity-converters.ts — master router that dispatches XLINE/RAY here.
 */

import type { AnySceneEntity } from '../types/scene';
import { extractEntityColor } from './dxf-converter-helpers';
import { dwarn } from '../debug';

/**
 * Convert XLINE entity (infinite construction line, t ∈ (-∞,+∞)).
 */
export function convertXLine(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const bx = parseFloat(data['10']);
  const by = parseFloat(data['20']);
  const dx = parseFloat(data['11']);
  const dy = parseFloat(data['21']);

  if (isNaN(bx) || isNaN(by) || isNaN(dx) || isNaN(dy)) {
    dwarn('EntityConverter', `⚠️ Skipping XLINE ${index}: missing coordinates`, {
      bx, by, dx, dy, available: Object.keys(data)
    });
    return null;
  }

  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) {
    dwarn('EntityConverter', `⚠️ Skipping XLINE ${index}: degenerate direction vector`, { dx, dy });
    return null;
  }

  if (data['30'] !== undefined && parseFloat(data['30']) !== 0) {
    dwarn('EntityConverter', `⚠️ XLINE ${index}: 3D z-coord ignored (2D viewer)`, { z: data['30'] });
  }

  const color = extractEntityColor(data);

  return {
    id: `xline_${index}`,
    type: 'xline',
    layerId: layer,
    visible: true,
    basePoint: { x: bx, y: by },
    direction: { x: dx / len, y: dy / len },
    ...(color && { color })
  };
}

/**
 * Convert RAY entity (semi-infinite ray, t ∈ [0,+∞)).
 */
export function convertRay(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const bx = parseFloat(data['10']);
  const by = parseFloat(data['20']);
  const dx = parseFloat(data['11']);
  const dy = parseFloat(data['21']);

  if (isNaN(bx) || isNaN(by) || isNaN(dx) || isNaN(dy)) {
    dwarn('EntityConverter', `⚠️ Skipping RAY ${index}: missing coordinates`, {
      bx, by, dx, dy, available: Object.keys(data)
    });
    return null;
  }

  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) {
    dwarn('EntityConverter', `⚠️ Skipping RAY ${index}: degenerate direction vector`, { dx, dy });
    return null;
  }

  if (data['30'] !== undefined && parseFloat(data['30']) !== 0) {
    dwarn('EntityConverter', `⚠️ RAY ${index}: 3D z-coord ignored (2D viewer)`, { z: data['30'] });
  }

  const color = extractEntityColor(data);

  return {
    id: `ray_${index}`,
    type: 'ray',
    layerId: layer,
    visible: true,
    basePoint: { x: bx, y: by },
    direction: { x: dx / len, y: dy / len },
    ...(color && { color })
  };
}
