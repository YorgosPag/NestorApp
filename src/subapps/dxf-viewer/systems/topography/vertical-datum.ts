/**
 * ADR-650 M10c — the project VERTICAL datum: which survey elevation maps to internal z=0.
 *
 * The planar geo-reference (`geo-transform`, M10b) seats the survey UNDER the building in x/y.
 * This is its vertical counterpart: the survey carries REAL elevations (ΕΓΣΑ world Z, e.g. ~106 m),
 * but the building is modelled in a FLOOR-LOCAL frame whose ground floor sits at z=0. Rendered as-is,
 * the terrain floats at its real altitude, a hundred metres above the building it belongs to.
 *
 * Big-player parity: ArchiCAD «Project Zero» / Revit «acquire elevation at the base point» — one
 * scalar altitude is declared to BE internal zero, and every real-elevation surface displays
 * relative to it (`displayZ = surveyZ − datum`). The building never moves (no grip/snap regression,
 * ADR-040); only the analysis surface is re-seated, exactly as M10b re-seats it in plan.
 *
 * Auto-acquired, not guessed: the datum is the ground elevation directly UNDER the building's local
 * origin (`originWorld`), read from the SAME barycentric TIN sampler the volume engine uses — so the
 * ground the building sits on becomes internal zero. When the origin falls outside the surveyed area
 * the surface's mid-height is used instead, so the hill is centred on the building rather than
 * floating. A future «Project Zero» override can persist an explicit datum on top of this default.
 *
 * @module systems/topography/vertical-datum
 */

import type { TinSurface } from './topo-types';
import { createTinSampler } from './tin-sampler';
import { getTopoSurface } from './topo-surface';
import { getGeoReference } from '../geo-referencing/geo-reference-store';

/**
 * ADR-650 M10d — how far (canonical mm) the terrain display is dropped BELOW internal z=0.
 *
 * The datum seats the ground under the building origin at exactly z=0 — which is also where the
 * ground floor's 2D plan content (DXF linework + placed images at `floorElevationMm=0`) lives. Two
 * opaque things at the identical depth → the plan occludes the terrain from above («κάτοψη κρύβει
 * το ανάγλυφο»). Big-player answer (Giorgio: «κάτοψη πάνω, έδαφος κάτω»): the drafting sheet stays
 * on top; the natural ground reads as context a hair below the finished floor. A pure world-space
 * translation of the terrain group (mesh + contours drop together), NOT `polygonOffset` — the
 * latter is depth-slope-scaled and blew the floating survey out of the depth range (M10c regression).
 * A few centimetres is imperceptible at building scale but decisively clears the depth tie.
 */
export const TERRAIN_DISPLAY_DROP_MM = 50;

/**
 * The survey elevation (WORLD canonical mm) that should render at internal z=0, given the building's
 * origin in world coordinates. Pure — the impure store reads live in {@link getActiveVerticalDatumMm}.
 */
export function resolveVerticalDatumMm(
  tin: TinSurface,
  originWorldXMm: number,
  originWorldYMm: number,
): number {
  if (tin.triangles.length === 0) return 0;
  const groundZ = createTinSampler(tin).zAtMm(originWorldXMm, originWorldYMm);
  if (groundZ !== null && Number.isFinite(groundZ)) return groundZ;
  // Origin not over the surveyed area → centre the surface on the building instead of floating.
  return (tin.bounds.minZ + tin.bounds.maxZ) / 2;
}

/**
 * The ACTIVE project vertical datum (WORLD canonical mm) for the current survey + geo-reference.
 * The ONE impure entry the 3D survey layers share (mirror of `getActiveWorldToDisplayProjector`),
 * so the terrain and the point cloud re-seat by the SAME datum and never split vertically.
 * The building's local origin (0,0) maps to world `originWorld`; identity geo-ref → world (0,0).
 */
export function getActiveVerticalDatumMm(): number {
  const origin = getGeoReference()?.originWorld ?? { x: 0, y: 0 };
  return resolveVerticalDatumMm(getTopoSurface(), origin.x, origin.y);
}
