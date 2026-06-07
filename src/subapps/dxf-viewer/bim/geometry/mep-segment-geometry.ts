/**
 * MEP segment geometry computation (ADR-408 Φ8).
 *
 * Pure SSoT: derives `MepSegmentGeometry` cache from `MepSegmentParams`.
 * Idempotent + side-effect free. Mirrors `beam-geometry.ts` (axis + perpendicular
 * offset → plan outline) — a duct/pipe run renders in plan as a single closed
 * rectangle (section-width × length), like a beam.
 *
 * Units: geometric points in canvas units; numeric scalars (length/area/volume)
 * in m / m² / m³ for direct BOQ feed.
 *
 * @see ./beam-geometry.ts (template)
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 */

import type { Point3D, Polyline3D, Polygon3D, BoundingBox3D } from '../types/bim-base';
import type { MepSegmentGeometry, MepSegmentParams } from '../types/mep-segment-types';
import {
  resolveSegmentSection,
  resolveSegmentEndpointElevationsMm,
  MIN_SEGMENT_DIMENSION_MM,
  MIN_SEGMENT_LENGTH_MM,
} from '../types/mep-segment-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import { offsetPolyline } from './shared/polygon-utils';
import { roundCrossSectionAreaMm2, roundPerimeterMm, rectPerimeterMm } from './shared/round-profile';

const MM_TO_M = 1 / 1000;
const MM2_TO_M2 = 1e-6;

export interface MepSegmentValidationResult {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Compute `MepSegmentGeometry` from `MepSegmentParams`. Pure SSoT. Caller MUST
 * ensure section dims > 0 (validator guard upstream).
 */
export function computeMepSegmentGeometry(params: MepSegmentParams): MepSegmentGeometry {
  // s: canvas units per 1 mm — converts mm section dims → canvas-unit offsets for
  // the 2D plan outline. Axis vertices are always in canvas units already.
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const section = resolveSegmentSection(params);

  const axisVertices: readonly Point3D[] = [params.startPoint, params.endPoint];
  const axisPolyline: Polyline3D = { points: axisVertices, closed: false };

  // Plan footprint width = the section's HORIZONTAL extent (round ⇒ diameter,
  // rectangular ⇒ width). Height is the out-of-plan (vertical) extent.
  const planWidthMm = section.widthMm;
  const outlineVertices = buildOutlineRect(axisVertices, planWidthMm, s);
  const outline: Polygon3D = { vertices: outlineVertices };

  // Per-endpoint elevations (ADR-408 Φ-A) — drive BOTH the true-3D BOQ length
  // (below) and the bbox z-range (further down).
  const elev = resolveSegmentEndpointElevationsMm(params);

  // BOQ rollups — TRUE 3D length (ADR-408 Φ14 #2): a sloped run is longer than its
  // plan projection. Unit-consistent: plan (canvas → mm) and vertical drop (already
  // mm) combined in mm, then → m. surfaceArea/volume below multiply by lengthM, so
  // they pick up the 3D length automatically.
  const planMm = computePolylineLengthMm(axisVertices) * (1 / s);
  const dzMm = elev.endMm - elev.startMm;
  const lengthM = Math.hypot(planMm, dzMm) * MM_TO_M;

  const crossSectionAreaMm2 =
    section.diameterMm !== null
      ? roundCrossSectionAreaMm2(section.diameterMm)
      : section.widthMm * section.heightMm;
  const perimeterMm =
    section.diameterMm !== null
      ? roundPerimeterMm(section.diameterMm)
      : rectPerimeterMm(section.widthMm, section.heightMm);

  const crossSectionAreaM2 = crossSectionAreaMm2 * MM2_TO_M2;
  const surfaceAreaM2 = perimeterMm * MM_TO_M * lengthM;
  const volume = crossSectionAreaM2 * lengthM;

  // bbox z range spans the two endpoint elevations (± section half-height); reuses
  // the `elev` resolved above.
  const bbox = computeBbox(axisVertices, outlineVertices, elev.startMm, elev.endMm, section.heightMm);

  return {
    axisPolyline,
    outline,
    bbox,
    length: lengthM,
    crossSectionAreaM2,
    surfaceAreaM2,
    volume,
  };
}

/**
 * Recompute segment geometry with the run SHORTENED at each end by the given
 * trim (mm) — Revit "pipe stops at the fitting face" (ADR-408 Φ11). Pure: moves
 * `startPoint`/`endPoint` inward along the axis, then re-runs the geometry SSoT,
 * so the outline/axis/bbox all follow. Over-trim (start+end ≥ length) is clamped
 * to a thin sliver so the segment never inverts. `0/0` trim returns the unchanged
 * geometry shape (callers pass the cached geometry instead in that case).
 */
export function computeTrimmedSegmentGeometry(
  params: MepSegmentParams,
  startMm: number,
  endMm: number,
): MepSegmentGeometry {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const { startPoint, endPoint } = params;
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const lenCanvas = Math.hypot(dx, dy);
  if (lenCanvas < 1e-9) return computeMepSegmentGeometry(params);

  const ux = dx / lenCanvas;
  const uy = dy / lenCanvas;
  let startCanvas = Math.max(0, startMm) * s;
  let endCanvas = Math.max(0, endMm) * s;
  // Clamp so a sliver (10%) always remains — never invert the run.
  const maxTrim = lenCanvas * 0.9;
  if (startCanvas + endCanvas > maxTrim) {
    const scale = maxTrim / (startCanvas + endCanvas);
    startCanvas *= scale;
    endCanvas *= scale;
  }

  const trimmed: MepSegmentParams = {
    ...params,
    startPoint: { ...startPoint, x: startPoint.x + ux * startCanvas, y: startPoint.y + uy * startCanvas },
    endPoint: { ...endPoint, x: endPoint.x - ux * endCanvas, y: endPoint.y - uy * endCanvas },
  };
  return computeMepSegmentGeometry(trimmed);
}

/**
 * Hard/soft validation of segment params. Errors abort entity creation; warnings
 * are advisory (mirror beam validator shape).
 */
export function validateMepSegmentParams(params: MepSegmentParams): MepSegmentValidationResult {
  const errors: string[] = [];
  const section = resolveSegmentSection(params);
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  // ADR-408 Φ15 — measure the TRUE 3D length (plan run + vertical drop), so a
  // VERTICAL riser (κατακόρυφη στήλη: coincident XY, large Δz) is NOT rejected as
  // "too short". Mirrors `computeMepSegmentGeometry`'s 3D length. Boy-Scout: also
  // correct for any steep run (a near-vertical pipe was previously under-measured).
  const planMm = computePolylineLengthMm([params.startPoint, params.endPoint]) * (1 / s);
  const elev = resolveSegmentEndpointElevationsMm(params);
  const lengthMm = Math.hypot(planMm, elev.endMm - elev.startMm);

  if (lengthMm < MIN_SEGMENT_LENGTH_MM) {
    errors.push('mepSegment.tooShort');
  }
  if (section.widthMm < MIN_SEGMENT_DIMENSION_MM || section.heightMm < MIN_SEGMENT_DIMENSION_MM) {
    errors.push('mepSegment.sectionTooSmall');
  }
  return { errors, warnings: [] };
}

// ─── Internal helpers (mirror beam-geometry) ─────────────────────────────────────

function buildOutlineRect(axis: readonly Point3D[], widthMm: number, s: number): Point3D[] {
  const n = axis.length;
  if (n < 2 || widthMm <= 0) {
    return [...axis];
  }
  const half = (widthMm * s) / 2;
  // ADR-408 Φ15 — a VERTICAL riser has coincident-XY endpoints: the mitre normals
  // are undefined (offsetPolyline would emit NaN → NaN bbox). Its plan footprint is
  // the pipe seen END-ON: a small square of the section width centred on the point.
  const a = axis[0];
  const b = axis[n - 1];
  if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-6) {
    return [
      { x: a.x - half, y: a.y - half, z: 0 },
      { x: a.x + half, y: a.y - half, z: 0 },
      { x: a.x + half, y: a.y + half, z: 0 },
      { x: a.x - half, y: a.y + half, z: 0 },
    ];
  }
  const plus = offsetPolyline(axis, half, 1);
  const minus = offsetPolyline(axis, half, -1);
  const polygon: Point3D[] = [...plus];
  for (let i = minus.length - 1; i >= 0; i--) polygon.push(minus[i]);
  return polygon;
}

function computePolylineLengthMm(vertices: readonly Point3D[]): number {
  let len = 0;
  for (let i = 1; i < vertices.length; i++) {
    const a = vertices[i - 1];
    const b = vertices[i];
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

/**
 * Axis-aligned 3D bbox. The z range spans the two endpoint elevations (a sloped
 * run rises from one end to the other), each padded by the section half-height:
 * [min(startMm,endMm) − h/2, max(startMm,endMm) + h/2] (mm → m).
 */
function computeBbox(
  axis: readonly Point3D[],
  outline: readonly Point3D[],
  startElevMm: number,
  endElevMm: number,
  heightMm: number,
): BoundingBox3D {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  const fold = (p: Point3D): void => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  };
  for (const p of axis) fold(p);
  for (const p of outline) fold(p);
  const halfH = heightMm / 2;
  const lowMm = Math.min(startElevMm, endElevMm) - halfH;
  const highMm = Math.max(startElevMm, endElevMm) + halfH;
  return {
    min: { x: minX, y: minY, z: lowMm / 1000 },
    max: { x: maxX, y: maxY, z: highMm / 1000 },
  };
}
