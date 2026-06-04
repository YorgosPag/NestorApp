/**
 * mep-fitting-to-mesh — MEP pipe fitting → THREE.Object3D (ADR-408 Φ11).
 *
 * Materialises the connection solid at a junction of two or more MEP segments
 * (Revit "Pipe Fitting"; IFC `IfcPipeFitting`). UNLIKE the linear `mep-segment`
 * (ADR-408 Φ8) the fitting is point-based: it sits at `params.position` (node
 * centre) and bridges the incident pipe centrelines.
 *
 * Geometry per `kind` (parametric on `primaryDiameterMm`, oriented by each
 * `incidents[].directionUnit`, centred at `position`, z = centerlineElevationMm):
 *   - `'elbow'`    → `'radiused'`: TubeGeometry along an arc between the two
 *                    incident directions; `'mitered'`: two short mitred cylinders.
 *   - `'coupling'` → short cylinder along the collinear axis, Ø slightly > pipe.
 *   - `'reducer'`  → truncated cone (radiusTop = primary/2, radiusBottom = secondary/2).
 *   - `'tee'`      → main-run cylinder + branch cylinder.
 *   - `'cross'`    → two crossed cylinders.
 *   - `'cap'`      → hemisphere (dead end).
 *
 * Coordinate convention (same as `mepSegmentToMesh` / BimToThreeConverter):
 *   DXF plan: X = East, Y = North (canvas world; metres when sceneUnits='m').
 *   Three.js world (Y-up): x = East, y = Up, z = −North.
 *
 * Units-safe: `position` / incident directions are canvas-world coords scaled
 * to metres via `sceneUnitsToMeters`. Scalar mm params (diameters,
 * centerlineElevationMm) are stored as mm and MUST be multiplied by MM_TO_M
 * before entering Three.js. Mirrors the `mepSegmentToMesh` (stair-safe) pattern
 * — NOT the legacy `fixtureToMesh` bug.
 *
 * @see ./mep-segment-to-mesh.ts  — units-safe sweep template
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 */

import * as THREE from 'three';
import type { Point3D } from '../../bim/types/bim-base';
import type {
  MepFittingEntity,
  MepFittingIncident,
  MepFittingParams,
} from '../../bim/types/mep-fitting-types';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { getElementMaterial3D } from '../materials/MaterialCatalog3D';
import { tagMesh } from './bim-three-shape-helpers';

/** mm → Three.js world metres (shared constant, same as all other converters). */
const MM_TO_M = 0.001;

/** Radial segment count for cylindrical fitting bodies. */
const RADIAL_SEGMENTS = 16;

/** Material id for all fitting solids (MaterialCatalog3D, foundation). */
const FITTING_MAT_ID = 'elem-mep-fitting';

/**
 * Plan direction unit (x=East, y=North) → Three.js world direction (Y-up).
 * Plan Y (north) maps to world −Z; vertical component is zero (pipes run flat
 * in plan-space). Returns a normalised vector (defensive against drift).
 */
function planDirToWorld(dir: Point3D): THREE.Vector3 {
  const v = new THREE.Vector3(dir.x, 0, -dir.y);
  return v.lengthSq() > 1e-12 ? v.normalize() : new THREE.Vector3(1, 0, 0);
}

/**
 * Place a Y-aligned cylinder/cone (CylinderGeometry default axis = +Y) along an
 * arbitrary world `axis`, centred at the world origin (local Group space). Used
 * by every cylinder-bodied kind so the per-kind builders stay <40 lines.
 */
function orientAlongAxis(mesh: THREE.Mesh, axis: THREE.Vector3): THREE.Mesh {
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    axis.lengthSq() > 1e-12 ? axis.clone().normalize() : new THREE.Vector3(0, 1, 0),
  );
  mesh.quaternion.copy(quat);
  return mesh;
}

/** A short cylinder centred on origin, oriented along `axis`. */
function buildCylinderAlong(
  axis: THREE.Vector3,
  radiusM: number,
  lengthM: number,
  material: THREE.Material,
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radiusM, radiusM, lengthM, RADIAL_SEGMENTS);
  return orientAlongAxis(new THREE.Mesh(geo, material), axis);
}

/** Body length of an inline/branch cylinder body for a given Ø (≈1× diameter). */
function bodyLengthM(diameterMm: number): number {
  return Math.max(diameterMm, 1) * MM_TO_M;
}

/** Coupling: a short cylinder along the collinear axis, Ø slightly > pipe. */
function buildCoupling(params: MepFittingParams, material: THREE.Material): THREE.Object3D {
  const axis = planDirToWorld(params.incidents[0]?.directionUnit ?? { x: 1, y: 0 });
  const r = (params.primaryDiameterMm * MM_TO_M) / 2 * 1.15;
  return buildCylinderAlong(axis, r, bodyLengthM(params.primaryDiameterMm), material);
}

/** Reducer: truncated cone (radiusTop = primary/2, radiusBottom = secondary/2). */
function buildReducer(params: MepFittingParams, material: THREE.Material): THREE.Object3D {
  const axis = planDirToWorld(params.incidents[0]?.directionUnit ?? { x: 1, y: 0 });
  const rTop = (params.primaryDiameterMm * MM_TO_M) / 2;
  const rBot = ((params.secondaryDiameterMm ?? params.primaryDiameterMm) * MM_TO_M) / 2;
  const lengthM = bodyLengthM(params.primaryDiameterMm);
  const geo = new THREE.CylinderGeometry(rTop, rBot, lengthM, RADIAL_SEGMENTS);
  return orientAlongAxis(new THREE.Mesh(geo, material), axis);
}

/** Cap: a hemisphere closing a dead-end pipe, dome facing along the incident dir. */
function buildCap(params: MepFittingParams, material: THREE.Material): THREE.Object3D {
  const axis = planDirToWorld(params.incidents[0]?.directionUnit ?? { x: 1, y: 0 });
  const r = (params.primaryDiameterMm * MM_TO_M) / 2;
  const geo = new THREE.SphereGeometry(r, RADIAL_SEGMENTS, RADIAL_SEGMENTS, 0, Math.PI * 2, 0, Math.PI / 2);
  return orientAlongAxis(new THREE.Mesh(geo, material), axis);
}

/** Radiused elbow: a TubeGeometry along an arc between the two incident dirs. */
function buildRadiusedElbow(params: MepFittingParams, material: THREE.Material): THREE.Object3D {
  const r = (params.primaryDiameterMm * MM_TO_M) / 2;
  const reach = params.primaryDiameterMm * MM_TO_M;
  const a = planDirToWorld(params.incidents[0]?.directionUnit ?? { x: 1, y: 0 }).multiplyScalar(reach);
  const b = planDirToWorld(params.incidents[1]?.directionUnit ?? { x: 0, y: 1 }).multiplyScalar(reach);
  const curve = new THREE.QuadraticBezierCurve3(a, new THREE.Vector3(0, 0, 0), b);
  const geo = new THREE.TubeGeometry(curve, 12, r, RADIAL_SEGMENTS, false);
  return new THREE.Mesh(geo, material);
}

/** Two short cylinders mitred at the node, one per incident direction. */
function buildMiteredElbow(params: MepFittingParams, material: THREE.Material): THREE.Object3D {
  const group = new THREE.Group();
  const r = (params.primaryDiameterMm * MM_TO_M) / 2;
  const half = bodyLengthM(params.primaryDiameterMm) / 2;
  for (const inc of params.incidents.slice(0, 2)) {
    const axis = planDirToWorld(inc.directionUnit);
    const arm = buildCylinderAlong(axis, r, half, material);
    arm.position.copy(axis.clone().multiplyScalar(half / 2));
    group.add(arm);
  }
  return group;
}

/** Elbow dispatcher (radiused default, mitered alternative). */
function buildElbow(params: MepFittingParams, material: THREE.Material): THREE.Object3D {
  return params.elbowStyle === 'mitered'
    ? buildMiteredElbow(params, material)
    : buildRadiusedElbow(params, material);
}

/**
 * One half-arm cylinder per incident, each from the node centre outward, sized
 * by the incident's own Ø. Shared by tee (3 arms) + cross (4 arms).
 */
function buildArms(
  incidents: readonly MepFittingIncident[],
  material: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  for (const inc of incidents) {
    const axis = planDirToWorld(inc.directionUnit);
    const r = (inc.diameterMm * MM_TO_M) / 2;
    const half = bodyLengthM(inc.diameterMm) / 2;
    const arm = buildCylinderAlong(axis, r, half, material);
    arm.position.copy(axis.clone().multiplyScalar(half / 2));
    group.add(arm);
  }
  return group;
}

/** Resolve the per-kind local-space Object3D (centred at the node origin). */
function buildFittingBody(params: MepFittingParams, material: THREE.Material): THREE.Object3D {
  switch (params.kind) {
    case 'elbow':    return buildElbow(params, material);
    case 'coupling': return buildCoupling(params, material);
    case 'reducer':  return buildReducer(params, material);
    case 'tee':      return buildArms(params.incidents, material);
    case 'cross':    return buildArms(params.incidents, material);
    case 'cap':      return buildCap(params, material);
  }
}

/**
 * MEP fitting → THREE.Object3D (Group), placed at the junction node.
 *
 * The per-kind body is built in local space centred on the origin, then the
 * containing Group is positioned at the node world coords with Y =
 * `centerlineElevationMm * MM_TO_M + buildingBaseElevationM`.
 *
 * @param fitting                 The MepFittingEntity to convert.
 * @param floorElevationMm        Host storey floor elevation (mm). Unused (the
 *                                centreline elevation is absolute) — accepted for
 *                                API symmetry with the other sync* converters.
 * @param levelId                 Optional storey levelId for userData tagging.
 * @param buildingBaseElevationM  Building datum offset (m), same param as every
 *                                per-floor converter in BimSceneLayer.
 */
export function mepFittingToMesh(
  fitting: MepFittingEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Object3D | null {
  const { params } = fitting;
  if (params.incidents.length === 0 || params.primaryDiameterMm < 1) return null;

  const material = getElementMaterial3D('mep-fitting');
  const body = buildFittingBody(params, material);

  const group = new THREE.Group();
  group.add(body);

  // ── Place the node at world coords (plan → world: x = planX, z = −planY) ────
  const sceneToM = sceneUnitsToMeters(params.sceneUnits ?? 'mm');
  const worldX = params.position.x * sceneToM;
  const worldZ = -(params.position.y * sceneToM);
  const worldY = params.centerlineElevationMm * MM_TO_M + buildingBaseElevationM;
  group.position.set(worldX, worldY, worldZ);

  // ── userData (entityId pattern matching all other 3D converters) ───────────
  group.userData['entityId'] = fitting.id;
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      tagMesh(obj, fitting.id, 'mep-fitting', FITTING_MAT_ID, levelId);
    }
  });

  return group;
}
