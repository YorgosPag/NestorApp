/**
 * 🏢 ENTERPRISE: DXF CIRCLE / ARC Converters (extracted from `dxf-entity-converters.ts`, N.7.1).
 *
 * Both live in the OCS of their 210/220/230 (ADR-635 Φ C.29, `@/lib/dxf/dxf-ocs`) — the center, and for ARC the two
 * angles. Three cases, because the plan view of a plane has three shapes:
 *   - default (0,0,1)    → the numbers as written;
 *   - flipped (0,0,−1)   → still a circle: the center mirrors, and the arc's CCW-in-OCS runs CW seen from +Z, so the
 *                          mapped start/end also swap — the scene `arc` is always CCW in world;
 *   - any other N        → a tilted plane projects a circle to an ELLIPSE, which `center + radius` cannot say. The
 *                          OCS curve is sampled and goes through the planar reader, exactly as a polyline on that
 *                          plane would, so every sample keeps its true plan position and Z.
 */

import type { AnySceneEntity } from '../types/scene';
import type { Point2D } from '../rendering/types/Types';
import {
  dxfOcsAngleToPlanDeg,
  dxfOcsToWcs,
  dxfRealOr,
  isDefaultDxfExtrusion,
  isFlippedDxfExtrusion,
  readDxfExtrusion,
  type DxfVec3,
} from '@/lib/dxf/dxf-ocs';
import { tessellateArcDegrees } from '../rendering/entities/shared/geometry-arc-utils';
import { extractEntityColor } from './dxf-converter-helpers';
import { readPlanarPolylineElevation } from './dxf-elevation-reader';
import { sampleFullCircle } from './dxf-hatch-boundary-parser';
import { buildPolylineSceneEntity } from './dxf-polyline-scene-entity';
import { dwarn } from '../debug';

/** Sampling of a curve on a tilted plane — 5° keeps the chord within 0.1% of the radius. */
const TILTED_CURVE_MAX_SEG_DEG = 5;

/** An ARC spanning a whole turn — mapping its ends would collapse them onto one angle. */
const FULL_TURN_EPS = 1e-6;

/**
 * Parse + validate the shared center (10/20) + radius (40) triple for CIRCLE/ARC.
 * Single SSoT for the parse & NaN/positive-radius guard (jscpd twin removal, ADR-583).
 * Returns `null` (and warns) when the parameters are invalid.
 */
function parseValidCenterRadius(
  data: Record<string, string>,
  entityLabel: string,
  index: number,
): { centerX: number; centerY: number; radius: number } | null {
  const centerX = parseFloat(data['10']);
  const centerY = parseFloat(data['20']);
  const radius = parseFloat(data['40']);

  if (isNaN(centerX) || isNaN(centerY) || isNaN(radius) || radius <= 0) {
    dwarn('EntityConverter', `⚠️ Skipping ${entityLabel} ${index}: invalid parameters`, {
      centerX, centerY, radius
    });
    return null;
  }

  return { centerX, centerY, radius };
}

function planCenter(ocs: Point2D, data: Record<string, string>, extrusion: DxfVec3): Point2D {
  const world = dxfOcsToWcs({ x: ocs.x, y: ocs.y, z: dxfRealOr(data['30'], 0) }, extrusion);
  return { x: world.x, y: world.y };
}

/** Is this extrusion one a `center + radius` shape can still describe? */
function keepsCircularShape(extrusion: DxfVec3): boolean {
  return isDefaultDxfExtrusion(extrusion) || isFlippedDxfExtrusion(extrusion);
}

/**
 * Convert CIRCLE entity
 * DXF Codes: 10,20 = Center (OCS); 30 = OCS elevation; 40 = Radius; 210/220/230 = extrusion
 */
export function convertCircle(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const parsed = parseValidCenterRadius(data, 'CIRCLE', index);
  if (!parsed) return null;
  const { centerX, centerY, radius } = parsed;
  const ocsCenter = { x: centerX, y: centerY };

  const extrusion = readDxfExtrusion(data);
  if (!keepsCircularShape(extrusion)) {
    const planar = readPlanarPolylineElevation(sampleFullCircle(ocsCenter, radius, TILTED_CURVE_MAX_SEG_DEG), data, '30');
    return buildPolylineSceneEntity(planar.vertices, true, data, layer, index, 'CIRCLE', planar.fields);
  }

  const color = extractEntityColor(data);

  return {
    id: `circle_${index}`,
    type: 'circle',
    layerId: layer,
    visible: true,
    center: planCenter(ocsCenter, data, extrusion),
    radius,
    ...(color && { color })
  };
}

/** The plan angles of an arc: mapped, then swapped when the mapping reverses the turn. */
function planArcAngles(startAngle: number, endAngle: number, extrusion: DxfVec3): { startAngle: number; endAngle: number } {
  if (isDefaultDxfExtrusion(extrusion)) return { startAngle, endAngle };
  if (Math.abs(endAngle - startAngle) >= 360 - FULL_TURN_EPS) return { startAngle, endAngle };
  return {
    startAngle: dxfOcsAngleToPlanDeg(endAngle, extrusion),
    endAngle: dxfOcsAngleToPlanDeg(startAngle, extrusion),
  };
}

/** The OCS arc's own samples, in OCS order — the tilted case. */
function sampleOcsArc(center: Point2D, radius: number, startAngle: number, endAngle: number): Point2D[] {
  const sweep = ((endAngle - startAngle) % 360 + 360) % 360;
  if (sweep < FULL_TURN_EPS) return sampleFullCircle(center, radius, TILTED_CURVE_MAX_SEG_DEG);
  const segments = Math.max(2, Math.ceil(sweep / TILTED_CURVE_MAX_SEG_DEG));
  return tessellateArcDegrees({ center, radius, startAngle, endAngle }, segments);
}

/**
 * Convert ARC entity
 * DXF Codes: 10,20 = Center (OCS); 30 = OCS elevation; 40 = Radius; 50 = Start angle; 51 = End angle (CCW about the
 * extrusion, measured in the OCS); 210/220/230 = extrusion
 */
export function convertArc(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const parsed = parseValidCenterRadius(data, 'ARC', index);
  if (!parsed) return null;
  const { centerX, centerY, radius } = parsed;
  const ocsCenter = { x: centerX, y: centerY };
  const startAngle = parseFloat(data['50']) || 0;
  const endAngle = parseFloat(data['51']) || 360;

  const extrusion = readDxfExtrusion(data);
  if (!keepsCircularShape(extrusion)) {
    const ocsSamples = sampleOcsArc(ocsCenter, radius, startAngle, endAngle);
    const planar = readPlanarPolylineElevation(ocsSamples, data, '30');
    return buildPolylineSceneEntity(planar.vertices, false, data, layer, index, 'ARC', planar.fields);
  }

  const color = extractEntityColor(data);

  return {
    id: `arc_${index}`,
    type: 'arc',
    layerId: layer,
    visible: true,
    center: planCenter(ocsCenter, data, extrusion),
    radius,
    ...planArcAngles(startAngle, endAngle, extrusion),
    ...(color && { color })
  };
}
