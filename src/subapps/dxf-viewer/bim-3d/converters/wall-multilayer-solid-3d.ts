/**
 * Multi-layer SOLID wall builder (ADR-413) — per-layer split for a FLAT
 * multi-layer DNA wall that takes the solid (non-piece) path: curved/polyline
 * walls, or the defensive fall-through of `wallToMesh`.
 *
 * Builds one extruded band per DNA layer between two boundary polylines
 * interpolated outer→inner by cumulative thickness (`layerBoundaryFractions`).
 * Each band carries its own material/texture + aoMap UVs. The straight-wall
 * (mitered / openings / sloped / attached) per-layer split lives in
 * `BimToThreeConverter.buildStraightWallWithOpenings` (via `splitPieceByLayers`);
 * THIS module is only the simple flat-solid case.
 *
 * Coordinate convention: identical to `BimToThreeConverter` — plan `(x, y)` →
 * world `(x, height, -y)`; `extrudeAndRotate` lifts local Z to world Y.
 *
 * @see wall-layer-geometry.ts — the pure thickness-fraction math (shared SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-413-pbr-textures.md
 */

import * as THREE from 'three';
import type { WallEntity } from '../../bim/types/wall-types';
import type { Point3D } from '../../bim/types/bim-base';
import { getMaterial3D } from '../materials/MaterialCatalog3D';
import { buildWallShape, extrudeAndRotate } from './bim-three-shape-helpers';
import { attachEdgesProjection } from './bim-three-edges';
import { applyWallTilt } from './mesh-slope-shear';
import { ensureWorldUvs } from './bim-uv-helpers';
import { isMultiLayerWall, layerBoundaryFractions } from './wall-layer-geometry';

const MM_TO_M = 0.001;

/**
 * Per-layer flat solid wall. Returns null on degenerate input (so the caller
 * falls back to the single-mesh `buildWallShape` solid).
 */
export function buildMultiLayerSolidWall(
  wall: WallEntity,
  floorElevationMm: number,
  buildingBaseElevationM: number,
): THREE.Group | null {
  const dna = wall.params.dna;
  if (!isMultiLayerWall(dna)) return null;
  const outer = wall.geometry.outerEdge.points;
  const inner = wall.geometry.innerEdge.points;
  if (outer.length < 2 || inner.length !== outer.length) return null;
  const fracs = layerBoundaryFractions(dna);
  const lerpEdge = (f: number): Point3D[] =>
    outer.map((o, i) => ({ x: o.x + (inner[i].x - o.x) * f, y: o.y + (inner[i].y - o.y) * f, z: 0 }));
  const heightM = wall.params.height * MM_TO_M;
  const baseY = (floorElevationMm + wall.params.baseOffset) * MM_TO_M + buildingBaseElevationM;
  const group = new THREE.Group();
  for (let i = 0; i < dna.layers.length; i++) {
    if (fracs[i + 1] - fracs[i] < 1e-9) continue;
    addLayerBand(group, wall, buildWallShape(lerpEdge(fracs[i]), lerpEdge(fracs[i + 1])), heightM, baseY, dna.layers[i]);
  }
  if (group.children.length === 0) return null;
  group.userData['bimId'] = wall.id;
  group.userData['bimType'] = 'wall';
  return group;
}

/** Extrude + tag one layer band into the group (no-op when the shape is degenerate). */
function addLayerBand(
  group: THREE.Group,
  wall: WallEntity,
  shape: THREE.Shape | null,
  heightM: number,
  baseY: number,
  layer: { materialId: string; id: string },
): void {
  if (!shape) return;
  const geo = extrudeAndRotate(shape, heightM);
  ensureWorldUvs(geo);
  applyWallTilt(geo, wall.params); // No-op flat (curved walls aren't tilted here).
  const mesh = new THREE.Mesh(geo, getMaterial3D(layer.materialId));
  mesh.position.y = baseY;
  mesh.userData['bimId'] = wall.id;
  mesh.userData['bimType'] = 'wall';
  mesh.userData['layerId'] = layer.id;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  attachEdgesProjection(mesh, 'wall', 'common-edges');
  group.add(mesh);
}
