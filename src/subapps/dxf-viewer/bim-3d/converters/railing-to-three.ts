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

/** Post depth measured ALONG the path (round → diameter, rectangular → heightMm). */
function postDepthAlongPathMm(type: RailingEntity['params']['type']): number {
  const p = type.balusterPlacement.posts;
  if (!p.enabled) return 0;
  return p.profile.shape === 'round' ? p.profile.widthMm : p.profile.heightMm;
}

/**
 * Extend the rail's free ends outward (along the terminal tangent) so the tube
 * reaches the OUTER FACE of the end post instead of dying at its centre — the
 * Revit handrail-over-newel detail. Extension = half the post depth at each end
 * that carries a post (`atStart` / `atEnd`). xy is canvas units → convert the mm
 * extension via `MM_TO_M / sceneToM`. Returns a fresh array; never mutates.
 */
function extendRailEndsToPosts(
  path: readonly Point3D[],
  type: RailingEntity['params']['type'],
  sceneToM: number,
): Point3D[] {
  const out = path.map((p) => ({ ...p }));
  const posts = type.balusterPlacement.posts;
  const halfDepthMm = postDepthAlongPathMm(type) / 2;
  if (!posts.enabled || halfDepthMm <= 0 || out.length < 2) return out;
  const extCanvas = (halfDepthMm * MM_TO_M) / sceneToM; // mm → canvas units
  const push = (a: Point3D, b: Point3D): Point3D => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: a.x + (dx / len) * extCanvas, y: a.y + (dy / len) * extCanvas, z: a.z };
  };
  if (posts.atStart) out[0] = push(out[0], out[1]);
  if (posts.atEnd) out[out.length - 1] = push(out[out.length - 1], out[out.length - 2]);
  return out;
}

/**
 * Disc cap closing one open tube end so the hollow swept tube reads as a solid
 * member. `at` = the end point, `from` = the previous point — the cap normal
 * points outward (away from the tube), perpendicular to the terminal tangent.
 */
function buildTubeCap(at: THREE.Vector3, from: THREE.Vector3, radiusM: number): THREE.Mesh {
  const normal = new THREE.Vector3().subVectors(at, from).normalize();
  const cap = new THREE.Mesh(
    new THREE.CircleGeometry(radiusM, TUBE_RADIAL_SEGMENTS),
    getElementMaterial3D('railing'),
  );
  cap.position.copy(at);
  cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  cap.castShadow = true;
  cap.receiveShadow = true;
  return cap;
}

/**
 * One continuous rail (top / intermediate / handrail) → swept `TubeGeometry`
 * PLUS two end caps (`THREE.Group`), so the hollow tube closes at the ends and
 * the rail covers the end posts (extended to their outer face). Null for a
 * degenerate (<2-point) path.
 */
function buildRailTube(
  rail: RailSweep,
  railing: RailingEntity,
  sceneToM: number,
  floorElevationMm: number,
  buildingBaseElevationM: number,
  levelId?: string,
): THREE.Object3D | null {
  if (rail.path.length < 2) return null;
  const extended = extendRailEndsToPosts(rail.path, railing.params.type, sceneToM);
  const pts = extended.map((p: Point3D) =>
    new THREE.Vector3(
      p.x * sceneToM,
      worldY(p.z ?? 0, floorElevationMm, buildingBaseElevationM),
      -p.y * sceneToM,
    ),
  );
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0);
  const radiusM = Math.max(0.001, (rail.profile.widthMm / 2) * MM_TO_M);
  const geo = new THREE.TubeGeometry(curve, Math.max(1, pts.length - 1), radiusM, TUBE_RADIAL_SEGMENTS, false);
  const tube = new THREE.Mesh(geo, getElementMaterial3D('railing'));
  tube.castShadow = true;
  tube.receiveShadow = true;

  const out = new THREE.Group();
  out.add(tube);
  out.add(buildTubeCap(pts[0], pts[1], radiusM));
  out.add(buildTubeCap(pts[pts.length - 1], pts[pts.length - 2], radiusM));
  // Tag the group + every child so picking resolves any sub-mesh to the railing.
  tagComponent(out, railing.id, 'rail', levelId);
  out.children.forEach((c) => tagComponent(c, railing.id, 'rail', levelId));
  return out;
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
