/**
 * slab-opening-pick-mesh — invisible PICK mesh for a slab opening (ADR-535 Φ3b).
 *
 * A slab opening is a VOID: `slabToMesh` cuts it out of the host slab with
 * `pushHoles`, so the opening has NO geometry of its own and is therefore
 * unselectable in 3D (a ray through the hole hits nothing / whatever lies below).
 * Without a selection there are no reshape grips, so Φ3b can never start.
 *
 * This builds a zero-opacity, depth-transparent solid that exactly fills the hole
 * (same outline, same host-slab Y datum + slope), tagged with the opening's
 * `bimId` / `bimType='slab-opening'`. THREE's raycaster ignores material opacity
 * (only `visible:false` is skipped), so the invisible mesh IS pickable — a click
 * inside the hole now selects the opening (Revit: openings are selectable), which
 * sets `editBimType='slab-opening'` and surfaces the per-vertex reshape grips.
 *
 * FULL SSoT reuse — the SAME shape/extrude/datum/slope helpers `slabToMesh` uses
 * (`buildShape` / `extrudeAndRotate` / `hangDownMeshY` / `applySlabSlope`), so the
 * pick surface stays coplanar with the (possibly tilted) host slab. Pure /
 * side-effect free; returns null on a degenerate outline (< 3 vertices).
 */

import * as THREE from 'three';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import { buildShape, extrudeAndRotate, hangDownMeshY, stampBimIdentity } from './bim-three-shape-helpers';
import { applySlabSlope } from './mesh-slope-shear';
import { scalePoints } from '../../rendering/entities/shared/geometry-vector-utils';
import { sceneUnitsToMeters } from '../../utils/scene-units';

const MM_TO_M = 0.001;

/**
 * Build the invisible pickable mesh for `opening` hosted by `hostSlab`, or null
 * when the opening outline is degenerate. The mesh fills the host slab's hole at
 * the slab's vertical datum (top face = `levelElevation + heightOffsetFromLevel`,
 * hanging down by the slab thickness) and follows the slab's slope, so picking is
 * exact even on a tilted slab. Mirrors `slabToMesh`'s coordinate handling 1:1.
 */
export function slabOpeningPickMesh(
  opening: SlabOpeningEntity,
  hostSlab: SlabEntity,
  levelId?: string,
  buildingBaseElevationM = 0,
  floorElevationMm = 0,
): THREE.Mesh | null {
  const verts = opening.params.outline.vertices;
  if (verts.length < 3) return null;
  const sceneToM = sceneUnitsToMeters(hostSlab.params.sceneUnits ?? 'mm');
  const shape = buildShape(scalePoints(verts, sceneToM));
  if (!shape) return null;

  const thicknessM = hostSlab.params.thickness * MM_TO_M;
  const geo = extrudeAndRotate(shape, thicknessM);
  applySlabSlope(geo, hostSlab.params); // keep the pick surface coplanar with a tilted slab.

  const mesh = new THREE.Mesh(
    geo,
    // Invisible but pickable: opacity 0 renders nothing, depthWrite off keeps it
    // out of the depth buffer, but the raycaster still intersects it (it only
    // skips `visible:false`). No shadows.
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  const slabTopMm = hostSlab.params.levelElevation + (hostSlab.params.heightOffsetFromLevel ?? 0);
  mesh.position.y = hangDownMeshY(floorElevationMm, slabTopMm, thicknessM, buildingBaseElevationM);
  stampBimIdentity(mesh, { bimId: opening.id, bimType: 'slab-opening', levelId });
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
