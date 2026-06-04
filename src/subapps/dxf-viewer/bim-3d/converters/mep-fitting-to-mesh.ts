/**
 * mep-fitting-to-mesh — MEP pipe fitting → THREE.Object3D (ADR-408 Φ11).
 *
 * Materialises the connection solid at a junction of two or more MEP segments
 * (Revit "Pipe Fitting"; IFC `IfcPipeFitting`). UNLIKE the linear `mep-segment`
 * (ADR-408 Φ8) the fitting is point-based: it sits at `params.position` (node
 * centre) and bridges the incident pipe centrelines.
 *
 * Geometry is derived from the SAME generic body SSoT as the 2D footprint
 * (`mep-fitting-body.ts`) — `computeFittingBody` runs in plan-metres (node at the
 * local origin) and the result is switched on `body.form` to build the THREE solid,
 * so the 3D mesh and the 2D plan can never drift:
 *   - `'bend'`   (elbow)            → TubeGeometry swept along the circular bend.
 *   - `'inline'` (coupling/reducer) → a cylinder (equal radii) or reducing cone.
 *   - `'legs'`   (tee/cross)        → one arm cylinder per incident.
 *   - `'cap'`    (cap)              → a hemisphere dome facing outward.
 * The mitered elbow style stays a converter-level special case (the body SSoT
 * models only the radiused bend).
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
 * @see ../../bim/geometry/mep-fitting-body.ts — the shared body SSoT (2D + 3D + trim)
 * @see ./mep-segment-to-mesh.ts  — units-safe sweep template
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 */

import * as THREE from 'three';
import type { Point3D } from '../../bim/types/bim-base';
import type { MepFittingEntity, MepFittingParams } from '../../bim/types/mep-fitting-types';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import {
  computeFittingBody,
  type FittingBody,
  type FittingBodyInput,
} from '../../bim/geometry/mep-fitting-body';
import { getElementMaterial3D } from '../materials/MaterialCatalog3D';
import { tagMesh } from './bim-three-shape-helpers';

/** mm → Three.js world metres (shared constant, same as all other converters). */
const MM_TO_M = 0.001;

/** Radial segment count for cylindrical fitting bodies. */
const RADIAL_SEGMENTS = 16;

/** Tube sample count along the elbow centreline arc. */
const ELBOW_ARC_SEGMENTS = 16;

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

/** Adapt fitting params → the body SSoT input in metres (node at the local origin). */
function toBodyInput(params: MepFittingParams): FittingBodyInput {
  const base: FittingBodyInput = {
    kind: params.kind,
    node: { x: 0, y: 0 },
    incidents: params.incidents.map((inc) => ({
      dir: { x: inc.directionUnit.x, y: inc.directionUnit.y },
      diameter: inc.diameterMm * MM_TO_M,
    })),
    primaryDiameter: params.primaryDiameterMm * MM_TO_M,
  };
  return params.secondaryDiameterMm !== undefined
    ? { ...base, secondaryDiameter: params.secondaryDiameterMm * MM_TO_M }
    : base;
}

/**
 * Radiused elbow: a TubeGeometry swept along the TRUE circular centreline bend
 * (Revit long-radius R = 1.5·D), tangent to both legs. The pipe radius is recovered
 * from the bend's concentric walls (`outerRadius − centerRadius = Ø/2`). Each
 * centreline sample maps plan → world (x, 0, −y), so the tube ends land on the legs'
 * tangent points.
 */
function buildBendTube(
  bend: Extract<FittingBody, { form: 'bend' }>['bend'],
  material: THREE.Material,
): THREE.Object3D {
  let sweep = bend.endAngle - bend.startAngle;
  if (bend.anticlockwise && sweep > 0) sweep -= 2 * Math.PI;
  if (!bend.anticlockwise && sweep < 0) sweep += 2 * Math.PI;

  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= ELBOW_ARC_SEGMENTS; i++) {
    const t = bend.startAngle + (sweep * i) / ELBOW_ARC_SEGMENTS;
    const px = bend.center.x + bend.centerRadius * Math.cos(t);
    const py = bend.center.y + bend.centerRadius * Math.sin(t);
    pts.push(new THREE.Vector3(px, 0, -py)); // plan → world (Y-up, north = −Z)
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tubeRadius = Math.max(bend.outerRadius - bend.centerRadius, 1e-4);
  const geo = new THREE.TubeGeometry(curve, ELBOW_ARC_SEGMENTS, tubeRadius, RADIAL_SEGMENTS, false);
  return new THREE.Mesh(geo, material);
}

/** Inline body → a cylinder (coupling, equal radii) or a reducing cone (reducer). */
function buildInlineMesh(
  body: Extract<FittingBody, { form: 'inline' }>,
  material: THREE.Material,
): THREE.Object3D {
  const axis = planDirToWorld({ x: body.axis.x, y: body.axis.y, z: 0 });
  // CylinderGeometry(radiusTop=+Y, radiusBottom=−Y); +Y maps to +axis = radiusPos.
  const geo = new THREE.CylinderGeometry(
    body.radiusPos,
    body.radiusNeg,
    body.halfLength * 2,
    RADIAL_SEGMENTS,
  );
  return orientAlongAxis(new THREE.Mesh(geo, material), axis);
}

/** Tee/cross → one arm cylinder per incident, from the node centre outward. */
function buildLegsMesh(
  body: Extract<FittingBody, { form: 'legs' }>,
  material: THREE.Material,
): THREE.Object3D {
  const group = new THREE.Group();
  for (const leg of body.legs) {
    const axis = planDirToWorld({ x: leg.dir.x, y: leg.dir.y, z: 0 });
    const arm = buildCylinderAlong(axis, leg.radius, leg.halfLength, material);
    arm.position.copy(axis.clone().multiplyScalar(leg.halfLength / 2));
    group.add(arm);
  }
  return group;
}

/** Cap → a hemisphere dome facing the outward `dir` (away from the pipe). */
function buildCapMesh(
  body: Extract<FittingBody, { form: 'cap' }>,
  material: THREE.Material,
): THREE.Object3D {
  const axis = planDirToWorld({ x: body.dir.x, y: body.dir.y, z: 0 });
  const geo = new THREE.SphereGeometry(
    body.radius,
    RADIAL_SEGMENTS,
    RADIAL_SEGMENTS,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2,
  );
  return orientAlongAxis(new THREE.Mesh(geo, material), axis);
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

/** Degenerate node (collinear/no body) → a short inline stub along incident[0]. */
function buildFallbackStub(params: MepFittingParams, material: THREE.Material): THREE.Object3D {
  const axis = planDirToWorld(params.incidents[0]?.directionUnit ?? { x: 1, y: 0, z: 0 });
  const r = (params.primaryDiameterMm * MM_TO_M) / 2;
  return buildCylinderAlong(axis, r, bodyLengthM(params.primaryDiameterMm), material);
}

/** Resolve the per-kind body Object3D (local space, centred at the node origin). */
function buildFittingBodyMesh(params: MepFittingParams, material: THREE.Material): THREE.Object3D {
  // Mitered elbow: the body SSoT models only the radiused bend.
  if (params.kind === 'elbow' && params.elbowStyle === 'mitered') {
    return buildMiteredElbow(params, material);
  }
  const body = computeFittingBody(toBodyInput(params));
  if (!body) return buildFallbackStub(params, material);
  switch (body.form) {
    case 'bend':
      return buildBendTube(body.bend, material);
    case 'inline':
      return buildInlineMesh(body, material);
    case 'legs':
      return buildLegsMesh(body, material);
    case 'cap':
      return buildCapMesh(body, material);
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
  const body = buildFittingBodyMesh(params, material);

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
