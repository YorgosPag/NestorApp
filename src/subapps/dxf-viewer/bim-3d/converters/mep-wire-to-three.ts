/**
 * mep-wire-to-three — ADR-408 Φ7. Pure converter: a routed `CircuitWirePath` →
 * a 3D conduit `THREE.Mesh` (swept tube).
 *
 * Builds the 3D home-run conduit from the SSoT routing (`mep-wire-routing.ts`),
 * following the **units-safe** stair/railing pattern (NOT the latent-buggy
 * fixture pattern): plan X/Y (canvas units) scale to metres via `sceneToM`, while
 * the connector elevation (`zMm`, mm above FFL) converts via `MM_TO_M`. Correct
 * in mm / cm / m scenes alike.
 *
 * Coordinate convention (see BimToThreeConverter header):
 *   DXF plan: X = East, Y = North → Three.js world x = East, y = Up, z = -North.
 *
 * The tube follows a piecewise-`LineCurve3` `CurvePath` over the points of
 * `buildWirePolyline` — which already applies the path's `style` (straight /
 * orthogonal L-elbow / arc-sampled Bézier), so the 3D run is geometrically
 * identical to the 2D overlay polyline. Colour = the circuit's system colour,
 * via the cached `getSystemTintedMaterial3D` (no singleton mutation).
 *
 * @see ../../bim/mep-systems/mep-wire-routing.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import * as THREE from 'three';
import {
  buildWirePolyline,
  type CircuitWirePath,
} from '../../bim/mep-systems/mep-wire-routing';
import { hexToThreeInt } from '../../bim/mep-systems/mep-system-color';
import { getElementMaterial3D, getSystemTintedMaterial3D } from '../materials/MaterialCatalog3D';

const MM_TO_M = 0.001;
const TUBE_RADIAL_SEGMENTS = 6;
/** Conduit tube radius (mm). ~8mm radius ≈ 16mm dia — readable without dominating. */
const CONDUIT_RADIUS_MM = 8;

/** World Y (m) for an mm elevation above the storey datum. */
function worldY(elevationMm: number, floorElevationMm: number, buildingBaseElevationM: number): number {
  return buildingBaseElevationM + (floorElevationMm + elevationMm) * MM_TO_M;
}

/**
 * Build the conduit mesh for one circuit, or `null` when the path has < 2 points
 * (nothing to sweep). `sceneToM` = `sceneUnitsToMeters(units)` of the floor.
 */
export function wirePathToMesh(
  path: CircuitWirePath,
  sceneToM: number,
  floorElevationMm: number,
  baseElevationM: number,
): THREE.Mesh | null {
  const pts = buildWirePolyline(path);
  if (pts.length < 2) return null;
  const vecs = pts.map(
    (p) => new THREE.Vector3(p.x * sceneToM, worldY(p.zMm, floorElevationMm, baseElevationM), -p.y * sceneToM),
  );
  const curvePath = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 1; i < vecs.length; i++) curvePath.add(new THREE.LineCurve3(vecs[i - 1]!, vecs[i]!));
  const radiusM = Math.max(0.001, CONDUIT_RADIUS_MM * MM_TO_M);
  const geo = new THREE.TubeGeometry(curvePath, Math.max(1, vecs.length - 1), radiusM, TUBE_RADIAL_SEGMENTS, false);
  const colorInt = hexToThreeInt(path.colorHex);
  const mat = colorInt !== null
    ? getSystemTintedMaterial3D('mep-wire', colorInt)
    : getElementMaterial3D('mep-wire');
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData['mepWireSystemId'] = path.systemId;
  return mesh;
}
