/**
 * The `type:'polyline'` scene entity every polyline-shaped DXF import emits (extracted from
 * `dxf-entity-converters.ts`, N.7.1) — LWPOLYLINE, old-style POLYLINE, and a CIRCLE / ARC on a tilted
 * plane, whose plan projection is no longer a circle. One emitted shape, so downstream can't tell them apart.
 */

import type { AnySceneEntity } from '../types/scene';
import type { Point2D } from '../rendering/types/Types';
import { extractEntityColor } from './dxf-converter-helpers';
import type { PolylineElevationFields } from './entity-elevation';
import { dwarn } from '../debug';

/** Closed-flag bitmask of a polyline record (70 bit 1 — AutoCAD emits e.g. 129 = 128|1). */
export function isDxfPolylineClosed(data: Record<string, string>): boolean {
  return ((parseInt(data['70'] ?? '0', 10) || 0) & 1) === 1;
}

/**
 * `elevation` = the Z fields resolved by `dxf-elevation-reader` (OCS / 2D-vs-3D already decided by the caller).
 */
export function buildPolylineSceneEntity(
  vertices: Array<{ x: number; y: number }>,
  closed: boolean,
  data: Record<string, string>,
  layer: string,
  index: number,
  label: 'POLYLINE' | 'LWPOLYLINE' | 'CIRCLE' | 'ARC',
  elevation: PolylineElevationFields
): AnySceneEntity | null {
  if (vertices.length < 2) {
    dwarn('EntityConverter', `⚠️ Skipping ${label} ${index}: insufficient vertices`, vertices.length);
    return null;
  }

  const color = extractEntityColor(data);

  return {
    id: `polyline_${index}`,
    type: 'polyline',
    layerId: layer,
    visible: true,
    vertices,
    closed,
    ...elevation,
    ...(color && { color })
  };
}
