/**
 * MEP fitting geometry computation (ADR-408 Φ11).
 *
 * Pure SSoT: derives `MepFittingGeometry` cache from `MepFittingParams`.
 * Idempotent + side-effect free. Mirrors `mep-segment-geometry.ts` for units
 * (`mmToSceneUnits` for the canvas-unit plan outline, `MM_TO_M` for the metre BOQ
 * rollup) and shares its bbox/footprint helper style.
 *
 * A fitting renders in plan as a small square outline sized to its nominal Ø,
 * centred on the junction node. The bbox z range is centred on
 * `centerlineElevationMm` (Revit "Middle Elevation", same as the segment). The
 * `volumeM3` is a per-kind solid approximation for BOQ rollup (a bounding box of
 * the Ø for tees/crosses/elbows/caps; a half-sphere-ish approximation otherwise),
 * and `length` is the along-axis extent for inline fittings (coupling / reducer).
 *
 * Units: geometric points in canvas units; numeric scalars (volume / length) in
 * m³ / m for direct BOQ feed.
 *
 * @see ./mep-segment-geometry.ts (template)
 * @see ../types/mep-fitting-types.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 */

import type { Point3D, Polygon3D, BoundingBox3D } from '../types/bim-base';
import type { MepFittingGeometry, MepFittingParams } from '../types/mep-fitting-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import { computeElbowBend, tessellateBendFootprint } from './mep-fitting-bend';

const MM_TO_M = 1 / 1000;

/**
 * Per-kind multiple of the nominal Ø giving the fitting's along-axis footprint
 * size (Revit-ish proportions): an elbow/tee/cross body is ~1× Ø, a coupling
 * ~1.5× Ø (it laps both pipe ends), a reducer ~2× Ø (it tapers over a length), a
 * cap ~0.6× Ø (a shallow dome).
 */
const KIND_SIZE_FACTOR: Readonly<Record<MepFittingParams['kind'], number>> = {
  elbow: 1,
  tee: 1,
  cross: 1,
  coupling: 1.5,
  reducer: 2,
  cap: 0.6,
};

/**
 * Compute `MepFittingGeometry` from `MepFittingParams`. Pure SSoT. Diameter is
 * resolved from `primaryDiameterMm` (always > 0 for a classified junction).
 */
export function computeMepFittingGeometry(params: MepFittingParams): MepFittingGeometry {
  // s: canvas units per 1 mm — converts the mm diameter → canvas-unit half-extent
  // for the 2D plan outline. The node position is already in canvas units.
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const diameterMm = params.primaryDiameterMm;
  const sizeMm = diameterMm * (KIND_SIZE_FACTOR[params.kind] ?? 1);
  const halfCanvas = (sizeMm * s) / 2;

  // Elbow: the footprint is the real swept BEND BODY (concentric wall arcs),
  // tangent to both legs — a Revit long-radius elbow, NOT an axis-aligned box.
  // Falls back to the centred square for a degenerate/straight node.
  const footprint: Polygon3D = { vertices: buildFootprint(params, s, halfCanvas) };
  const bbox = computeBbox(footprint.vertices, params.centerlineElevationMm, sizeMm);
  const volumeM3 = computeVolumeM3(params, sizeMm);
  const length = inlineLengthM(params, sizeMm);

  return length !== undefined
    ? { footprint, bbox, volumeM3, length }
    : { footprint, bbox, volumeM3 };
}

// ─── Internal helpers (mirror mep-segment-geometry) ──────────────────────────────

/**
 * Plan footprint per kind. Elbow with two incidents → the swept bend body
 * (concentric wall arcs, canvas units) via the bend SSoT; everything else → the
 * centred square. `s` = canvas units per mm; `half` = square half-side fallback.
 */
function buildFootprint(params: MepFittingParams, s: number, half: number): Point3D[] {
  if (params.kind === 'elbow' && params.incidents.length >= 2) {
    const diameterCanvas = params.primaryDiameterMm * s;
    const bend = computeElbowBend(
      { x: params.position.x, y: params.position.y },
      params.incidents[0]!.directionUnit,
      params.incidents[1]!.directionUnit,
      diameterCanvas,
    );
    if (bend) return tessellateBendFootprint(bend);
  }
  return buildSquare(params.position, half);
}

/** CCW square centred on `centre`, half-side `half` (canvas units). */
function buildSquare(centre: Point3D, half: number): Point3D[] {
  const { x, y } = centre;
  return [
    { x: x - half, y: y - half, z: 0 },
    { x: x + half, y: y - half, z: 0 },
    { x: x + half, y: y + half, z: 0 },
    { x: x - half, y: y + half, z: 0 },
  ];
}

/**
 * Axis-aligned 3D bbox. z range centred on the centreline elevation:
 * [centerline − size/2, centerline + size/2] (mm → m), matching the segment.
 */
function computeBbox(
  outline: readonly Point3D[],
  centerlineMm: number,
  sizeMm: number,
): BoundingBox3D {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of outline) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const half = sizeMm / 2;
  return {
    min: { x: minX, y: minY, z: (centerlineMm - half) / 1000 },
    max: { x: maxX, y: maxY, z: (centerlineMm + half) / 1000 },
  };
}

/**
 * Per-kind solid volume approximation (m³) for BOQ rollup. Inline fittings
 * (coupling/reducer) ≈ cylinder of Ø over the size length; junction bodies
 * (elbow/tee/cross) ≈ Ø-sized box; cap ≈ half-sphere of Ø.
 */
function computeVolumeM3(params: MepFittingParams, sizeMm: number): number {
  const rM = params.primaryDiameterMm * MM_TO_M * 0.5;
  const lengthM = sizeMm * MM_TO_M;
  switch (params.kind) {
    case 'coupling':
    case 'reducer':
      return Math.PI * rM * rM * lengthM;
    case 'cap':
      return (2 / 3) * Math.PI * rM * rM * rM;
    default:
      // elbow / tee / cross — bounding box of the Ø-sized body.
      return lengthM * lengthM * (params.primaryDiameterMm * MM_TO_M);
  }
}

/** Along-axis length (m) for inline fittings; undefined for junction bodies/cap. */
function inlineLengthM(params: MepFittingParams, sizeMm: number): number | undefined {
  if (params.kind === 'coupling' || params.kind === 'reducer') {
    return sizeMm * MM_TO_M;
  }
  return undefined;
}
