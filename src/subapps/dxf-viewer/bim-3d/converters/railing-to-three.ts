/**
 * railing-to-three — ADR-407. Pure converter: `RailingEntity` → `THREE.Group`.
 *
 * Builds the 3D solid of a path-based railing from the SSoT `RailingGeometry`
 * (posts + balusters + rails). Following the **units-safe** stair-converter
 * pattern (NOT the latent-buggy fixture pattern): every canvas-unit XY is scaled
 * to metres via `sceneUnitsToMeters(units)`, while physical member sizes and
 * elevations (mm) convert via `MM_TO_M`. Correct in mm / cm / m scenes alike.
 *
 * Coordinate convention (see BimToThreeConverter header):
 *   DXF plan: X = East, Y = North → Three.js world x = East, y = Up, z = -North.
 *
 * Enterprise 3D ("όπως οι μεγάλοι"): the balusters — the high-count members —
 * are a single `THREE.InstancedMesh` (one draw call, per-instance Matrix4). Posts
 * are few → individual boxes; rails are swept `TubeGeometry` (mirror of the stair
 * handrail tube).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import * as THREE from 'three';
import type { RailingEntity, RailMemberSolid, RailProfile, RailSweep } from '../../bim/types/railing-types';
import type { Point3D } from '../../bim/types/bim-base';
import { getElementMaterial3D } from '../materials/MaterialCatalog3D';
import { sceneUnitsToMeters } from '../../utils/scene-units';

const MM_TO_M = 0.001;
const DEG_TO_RAD = Math.PI / 180;
const TUBE_RADIAL_SEGMENTS = 8;
const CYL_RADIAL_SEGMENTS = 10;

/** World Y (m) for an mm elevation above the storey datum. */
function worldY(elevationMm: number, floorElevationMm: number, buildingBaseElevationM: number): number {
  return buildingBaseElevationM + (floorElevationMm + elevationMm) * MM_TO_M;
}

/** Per-instance transform for a vertical member (post / baluster). */
function memberMatrix(
  m: RailMemberSolid,
  sceneToM: number,
  floorElevationMm: number,
  buildingBaseElevationM: number,
): THREE.Matrix4 {
  const heightM = m.heightMm * MM_TO_M;
  const x = m.basePoint.x * sceneToM;
  const z = -m.basePoint.y * sceneToM;
  const centreY = worldY((m.basePoint.z ?? 0) + m.heightMm / 2, floorElevationMm, buildingBaseElevationM);
  const widthM = m.profile.widthMm * MM_TO_M;
  const depthM = (m.profile.shape === 'round' ? m.profile.widthMm : m.profile.heightMm) * MM_TO_M;
  const position = new THREE.Vector3(x, centreY, z);
  // DXF plan CCW → clockwise about world Y (North flipped to -Z).
  const quaternion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    -m.rotationDeg * DEG_TO_RAD,
  );
  const scale = new THREE.Vector3(widthM, heightM, depthM);
  return new THREE.Matrix4().compose(position, quaternion, scale);
}

/** Unit geometry (height 1, footprint 1) for a member profile, centred at origin. */
function unitMemberGeometry(profile: RailProfile): THREE.BufferGeometry {
  return profile.shape === 'round'
    ? new THREE.CylinderGeometry(0.5, 0.5, 1, CYL_RADIAL_SEGMENTS)
    : new THREE.BoxGeometry(1, 1, 1);
}

/** Balusters → ONE InstancedMesh (one draw call). Null when empty. */
function buildBalusterInstances(
  railing: RailingEntity,
  sceneToM: number,
  floorElevationMm: number,
  buildingBaseElevationM: number,
  levelId?: string,
): THREE.InstancedMesh | null {
  const balusters = railing.geometry.balusters;
  if (balusters.length === 0) return null;
  const geo = unitMemberGeometry(railing.params.type.balusterPlacement.pattern.profile);
  const inst = new THREE.InstancedMesh(geo, getElementMaterial3D('railing'), balusters.length);
  balusters.forEach((b, i) => {
    inst.setMatrixAt(i, memberMatrix(b, sceneToM, floorElevationMm, buildingBaseElevationM));
  });
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = true;
  inst.receiveShadow = true;
  tagComponent(inst, railing.id, 'baluster', levelId);
  return inst;
}

/** Posts → individual boxes/cylinders (few members). */
function buildPosts(
  railing: RailingEntity,
  sceneToM: number,
  floorElevationMm: number,
  buildingBaseElevationM: number,
  levelId?: string,
): THREE.Mesh[] {
  return railing.geometry.posts.map((p) => {
    const mesh = new THREE.Mesh(unitMemberGeometry(p.profile), getElementMaterial3D('railing'));
    mesh.applyMatrix4(memberMatrix(p, sceneToM, floorElevationMm, buildingBaseElevationM));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    tagComponent(mesh, railing.id, 'post', levelId);
    return mesh;
  });
}

/** One continuous rail (top / intermediate / handrail) → swept TubeGeometry. */
function buildRailTube(
  rail: RailSweep,
  railing: RailingEntity,
  sceneToM: number,
  floorElevationMm: number,
  buildingBaseElevationM: number,
  levelId?: string,
): THREE.Mesh | null {
  if (rail.path.length < 2) return null;
  const pts = rail.path.map((p: Point3D) =>
    new THREE.Vector3(
      p.x * sceneToM,
      worldY(p.z ?? 0, floorElevationMm, buildingBaseElevationM),
      -p.y * sceneToM,
    ),
  );
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0);
  const radiusM = Math.max(0.001, (rail.profile.widthMm / 2) * MM_TO_M);
  const geo = new THREE.TubeGeometry(curve, Math.max(1, pts.length - 1), radiusM, TUBE_RADIAL_SEGMENTS, false);
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('railing'));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  tagComponent(mesh, railing.id, 'rail', levelId);
  return mesh;
}

/** Tag a railing sub-mesh so picking / sync resolves it back to the entity. */
function tagComponent(
  obj: THREE.Object3D,
  id: string,
  component: 'post' | 'baluster' | 'rail',
  levelId?: string,
): void {
  obj.userData['bimId'] = id;
  obj.userData['bimType'] = 'railing';
  obj.userData['railingComponent'] = component;
  obj.userData['matId'] = 'elem-railing';
  if (levelId !== undefined) obj.userData['levelId'] = levelId;
}

/**
 * ADR-407 — path-based railing → `THREE.Group` (posts + balusters + rails).
 * Returns null for a degenerate (sub-2-point) path. `floorElevationMm` is the
 * storey datum; the railing's own `baseElevationMm` lives in each member's z.
 */
export function railingToMesh(
  railing: RailingEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Group | null {
  if (!railing.geometry || railing.geometry.resolvedPath.length < 2) return null;
  const sceneToM = sceneUnitsToMeters(railing.params.sceneUnits ?? 'mm');

  const group = new THREE.Group();
  const balusters = buildBalusterInstances(railing, sceneToM, floorElevationMm, buildingBaseElevationM, levelId);
  if (balusters) group.add(balusters);
  for (const post of buildPosts(railing, sceneToM, floorElevationMm, buildingBaseElevationM, levelId)) {
    group.add(post);
  }
  for (const rail of railing.geometry.rails) {
    const tube = buildRailTube(rail, railing, sceneToM, floorElevationMm, buildingBaseElevationM, levelId);
    if (tube) group.add(tube);
  }
  if (group.children.length === 0) return null;
  group.userData['bimId'] = railing.id;
  group.userData['bimType'] = 'railing';
  if (levelId !== undefined) group.userData['levelId'] = levelId;
  return group;
}
