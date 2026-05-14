/**
 * ARC RADIUS EDIT — ADR-349 SSoT (Phase 1b.1)
 *
 * Pure math for arc midpoint grip → new radius/center, keeping both endpoints fixed.
 *
 * Geometry:
 *   - Chord = endpoint_end - endpoint_start
 *   - Chord midpoint M_c
 *   - sagitta = signed distance from M_c to the new midpoint along chord's perpendicular
 *   - radius = (chord_len² / 4 + sagitta²) / (2 · |sagitta|)
 *   - center = M_c + perp · (radius - sagitta) along the side opposite to the new midpoint
 *
 * @see ADR-349 §Multifunctional Grip Menu — ARC Radius edit
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ArcEntity } from '../../types/entities';
import { arcEndpointXY } from './lengthen-axial-stretch';

export interface ArcRadiusUpdate {
  readonly center: Point2D;
  readonly radius: number;
  readonly startAngle: number;
  readonly endAngle: number;
}

/**
 * Recompute arc geometry so it passes through both original endpoints AND the
 * supplied new midpoint. Returns null when geometry is degenerate.
 */
export function editArcFromMidpoint(arc: ArcEntity, newMidpoint: Point2D): ArcRadiusUpdate | null {
  const p1 = arcEndpointXY(arc.center, arc.radius, arc.startAngle);
  const p2 = arcEndpointXY(arc.center, arc.radius, arc.endAngle);

  const chordDx = p2.x - p1.x;
  const chordDy = p2.y - p1.y;
  const chordLen = Math.sqrt(chordDx * chordDx + chordDy * chordDy);
  if (chordLen < 1e-10) return null;

  const midChord: Point2D = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const perpX = -chordDy / chordLen;
  const perpY = chordDx / chordLen;

  const sagitta = (newMidpoint.x - midChord.x) * perpX + (newMidpoint.y - midChord.y) * perpY;
  if (Math.abs(sagitta) < 1e-10) return null;

  const radius = (chordLen * chordLen / 4 + sagitta * sagitta) / (2 * Math.abs(sagitta));
  const sign = sagitta >= 0 ? 1 : -1;
  const centerOffset = radius - Math.abs(sagitta);
  const center: Point2D = {
    x: midChord.x - perpX * centerOffset * sign,
    y: midChord.y - perpY * centerOffset * sign,
  };

  return {
    center,
    radius,
    startAngle: Math.atan2(p1.y - center.y, p1.x - center.x),
    endAngle: Math.atan2(p2.y - center.y, p2.x - center.x),
  };
}

/**
 * Recompute arc geometry given a new absolute radius value.
 * Endpoints stay fixed; sagitta sign preserved from original arc.
 */
export function editArcFromRadius(arc: ArcEntity, newRadius: number): ArcRadiusUpdate | null {
  if (newRadius <= 0) return null;

  const p1 = arcEndpointXY(arc.center, arc.radius, arc.startAngle);
  const p2 = arcEndpointXY(arc.center, arc.radius, arc.endAngle);
  const chordDx = p2.x - p1.x;
  const chordDy = p2.y - p1.y;
  const chordLen = Math.sqrt(chordDx * chordDx + chordDy * chordDy);
  if (chordLen < 1e-10) return null;
  if (newRadius < chordLen / 2) return null; // can't reach both endpoints

  const midChord: Point2D = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const perpX = -chordDy / chordLen;
  const perpY = chordDx / chordLen;
  const half = chordLen / 2;
  const distCenterToMid = Math.sqrt(newRadius * newRadius - half * half);

  // Preserve which side the original center was on
  const origSide = (arc.center.x - midChord.x) * perpX + (arc.center.y - midChord.y) * perpY;
  const sign = origSide >= 0 ? 1 : -1;
  const center: Point2D = {
    x: midChord.x + perpX * distCenterToMid * sign,
    y: midChord.y + perpY * distCenterToMid * sign,
  };

  return {
    center,
    radius: newRadius,
    startAngle: Math.atan2(p1.y - center.y, p1.x - center.x),
    endAngle: Math.atan2(p2.y - center.y, p2.x - center.x),
  };
}
