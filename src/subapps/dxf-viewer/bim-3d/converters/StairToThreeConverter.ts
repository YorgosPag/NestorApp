/**
 * StairToThreeConverter — pure functions: BIM stair entity → THREE.Mesh[].
 *
 * ADR-370 Phase 5 (3D parity με 2D read-only). Coordinate convention matches
 * BimToThreeConverter:
 *   DXF plan (mm): X = East, Y = North
 *   Three.js world (m, Y-up): x = East, y = Up, z = -North
 *
 * StairGeometry vertices are already in mm (storage canonical per ADR-358 §5.0)
 * and use Point3D with z = step elevation. We convert all coords to meters,
 * build Shape/Path in local XY plane, extrude along local Z, then rotate
 * -π/2 around X so local Z (extrusion) becomes world Y (height).
 *
 * Returns an array of meshes (1 stair = many meshes — treads + risers +
 * stringers + handrails + landings). BimSceneLayer adds each individually
 * to the scene group so per-mesh raycast hits resolve to the correct
 * stair component via userData.
 *
 * Skipped from 3D (2D-only): arrowSymbol, cutLine, treadLabels.
 */

import * as THREE from 'three';
import type { StairEntity, Polygon3D, Polyline3D, Segment3D } from '../../bim/types/stair-types';
import { resolveStairMaterial } from '../materials/stair-material-resolver';

const MM_TO_M = 0.001;
const ROT_X_NEG_90 = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

// Industry defaults (mm) — Revit/ArchiCAD aligned, applied when stair lacks explicit values.
const DEFAULT_TREAD_THICKNESS_MM = 40;
const DEFAULT_RISER_THICKNESS_MM = 20;
const DEFAULT_LANDING_THICKNESS_MM = 200;
const DEFAULT_HANDRAIL_RADIUS_MM = 25;
const DEFAULT_HANDRAIL_HEIGHT_MM = 900;
const HANDRAIL_TUBE_SEGMENTS = 8;

function shapeFromPolygon(poly: Polygon3D): THREE.Shape | null {
  if (poly.length < 3) return null;
  const shape = new THREE.Shape();
  const [first, ...rest] = poly;
  shape.moveTo(first.x * MM_TO_M, first.y * MM_TO_M);
  for (const p of rest) shape.lineTo(p.x * MM_TO_M, p.y * MM_TO_M);
  shape.closePath();
  return shape;
}

function tagMesh(
  mesh: THREE.Mesh,
  stair: StairEntity,
  component: string,
  levelId?: string,
): THREE.Mesh {
  mesh.userData['bimId'] = stair.id;
  mesh.userData['bimType'] = 'stair';
  mesh.userData['stairComponent'] = component;
  if (levelId !== undefined) mesh.userData['levelId'] = levelId;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ── Treads ────────────────────────────────────────────────────────────────────

function buildTreadMeshes(
  stair: StairEntity,
  baseY: number,
  levelId?: string,
): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const thicknessM = DEFAULT_TREAD_THICKNESS_MM * MM_TO_M;
  // Tread polygons co-planar at z = i·rise. We extrude DOWN by tread thickness so
  // the polygon's z plane becomes the WALKABLE top face of the step.
  const treads = stair.geometry.treads;
  for (let i = 0; i < treads.length; i++) {
    const poly = treads[i]!;
    const shape = shapeFromPolygon(poly);
    if (!shape) continue;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thicknessM, bevelEnabled: false });
    geo.applyMatrix4(ROT_X_NEG_90);
    const mat = resolveStairMaterial(stair, 'stair-tread', i);
    const mesh = new THREE.Mesh(geo, mat);
    // Polygon z is top-face elevation; extrude went into local +Z (= world -Y after rotation),
    // so geometry sits between [topZ - thicknessM, topZ]. Translate so top face stays at topZ.
    const topZmm = poly[0]!.z;
    mesh.position.y = baseY + topZmm * MM_TO_M;
    out.push(tagMesh(mesh, stair, 'tread', levelId));
  }
  return out;
}

// ── Risers (closed type only) ────────────────────────────────────────────────

function buildRiserMeshes(
  stair: StairEntity,
  baseY: number,
  levelId?: string,
): THREE.Mesh[] {
  if (stair.params.riserType !== 'closed') return [];
  const out: THREE.Mesh[] = [];
  const widthM = stair.params.width * MM_TO_M;
  const riseM = stair.params.rise * MM_TO_M;
  const thicknessM = DEFAULT_RISER_THICKNESS_MM * MM_TO_M;
  const mat = resolveStairMaterial(stair, 'stair-riser');
  for (const seg of stair.geometry.risers) {
    const mesh = buildRiserBox(seg, widthM, riseM, thicknessM, mat, baseY);
    if (mesh) out.push(tagMesh(mesh, stair, 'riser', levelId));
  }
  return out;
}

function buildRiserBox(
  seg: Segment3D,
  widthM: number,
  riseM: number,
  thicknessM: number,
  mat: THREE.MeshStandardMaterial,
  baseY: number,
): THREE.Mesh | null {
  const startM = { x: seg.start.x * MM_TO_M, y: seg.start.y * MM_TO_M };
  const endM = { x: seg.end.x * MM_TO_M, y: seg.end.y * MM_TO_M };
  // Riser segment is vertical (start.xy === end.xy). Build a thin box at this xy,
  // oriented perpendicular to the stair walk direction. Inferred from segment xy
  // position relative to centerline is non-trivial here; fall back to width along
  // local X axis (stair direction is param-level — kept simple in V1: world-axis box).
  const geo = new THREE.BoxGeometry(thicknessM, riseM, widthM);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(
    startM.x,
    baseY + (seg.start.z + seg.end.z) * 0.5 * MM_TO_M,
    -startM.y, // DXF Y → world -Z
  );
  return mesh;
}

// ── Stringers ─────────────────────────────────────────────────────────────────

function buildStringerMeshes(
  stair: StairEntity,
  baseY: number,
  levelId?: string,
): THREE.Mesh[] {
  const allowed = new Set(['stringer-1side', 'stringer-2side', 'central-stringer']);
  if (!allowed.has(stair.params.structureType)) return [];
  const sp = stair.params.stringerParams;
  if (!sp) return [];
  const widthM = sp.width * MM_TO_M;
  const heightM = sp.height * MM_TO_M;
  const mat = resolveStairMaterial(stair, 'stair-stringer');
  const meshes: THREE.Mesh[] = [];
  const inner = stair.geometry.stringers.inner;
  const outer = stair.geometry.stringers.outer;
  if (inner.length >= 2) meshes.push(...stringerSegmentsAlong(inner, widthM, heightM, mat, baseY, stair, levelId));
  if (outer.length >= 2) meshes.push(...stringerSegmentsAlong(outer, widthM, heightM, mat, baseY, stair, levelId));
  return meshes;
}

function stringerSegmentsAlong(
  poly: Polyline3D,
  widthM: number,
  heightM: number,
  mat: THREE.MeshStandardMaterial,
  baseY: number,
  stair: StairEntity,
  levelId?: string,
): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i]!;
    const b = poly[i + 1]!;
    const dxM = (b.x - a.x) * MM_TO_M;
    const dyM = (b.y - a.y) * MM_TO_M;
    const dzM = (b.z - a.z) * MM_TO_M;
    const lengthM = Math.hypot(dxM, dyM, dzM);
    if (lengthM < 1e-6) continue;
    const geo = new THREE.BoxGeometry(lengthM, heightM, widthM);
    const mesh = new THREE.Mesh(geo, mat);
    const midX = (a.x + b.x) * 0.5 * MM_TO_M;
    const midY = (a.y + b.y) * 0.5 * MM_TO_M;
    const midZ = (a.z + b.z) * 0.5 * MM_TO_M;
    mesh.position.set(midX, baseY + midZ - heightM * 0.5, -midY);
    // Orient box length along (a→b) in plan, allowing vertical tilt.
    const dirPlan = Math.atan2(-dyM, dxM); // world rotation around Y
    mesh.rotation.y = dirPlan;
    out.push(tagMesh(mesh, stair, 'stringer', levelId));
  }
  return out;
}

// ── Handrails ────────────────────────────────────────────────────────────────

function buildHandrailMeshes(
  stair: StairEntity,
  baseY: number,
  levelId?: string,
): THREE.Mesh[] {
  const hr = stair.params.handrails;
  if (!hr.inner && !hr.outer) return [];
  const out: THREE.Mesh[] = [];
  const radiusM = DEFAULT_HANDRAIL_RADIUS_MM * MM_TO_M;
  const heightOffsetM = (hr.height ?? DEFAULT_HANDRAIL_HEIGHT_MM) * MM_TO_M;
  const mat = resolveStairMaterial(stair, 'stair-handrail');
  if (hr.inner && stair.geometry.handrails.inner) {
    const mesh = handrailTube(stair.geometry.handrails.inner, radiusM, heightOffsetM, mat, baseY);
    if (mesh) out.push(tagMesh(mesh, stair, 'handrail-inner', levelId));
  }
  if (hr.outer && stair.geometry.handrails.outer) {
    const mesh = handrailTube(stair.geometry.handrails.outer, radiusM, heightOffsetM, mat, baseY);
    if (mesh) out.push(tagMesh(mesh, stair, 'handrail-outer', levelId));
  }
  return out;
}

function handrailTube(
  polyline: Polyline3D,
  radiusM: number,
  heightOffsetM: number,
  mat: THREE.MeshStandardMaterial,
  baseY: number,
): THREE.Mesh | null {
  if (polyline.length < 2) return null;
  const points: THREE.Vector3[] = polyline.map(
    (p) => new THREE.Vector3(
      p.x * MM_TO_M,
      baseY + p.z * MM_TO_M + heightOffsetM,
      -p.y * MM_TO_M,
    ),
  );
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.0);
  const tubularSegments = Math.max(8, (polyline.length - 1) * 4);
  const geo = new THREE.TubeGeometry(curve, tubularSegments, radiusM, HANDRAIL_TUBE_SEGMENTS, false);
  return new THREE.Mesh(geo, mat);
}

// ── Landings ─────────────────────────────────────────────────────────────────

function buildLandingMeshes(
  stair: StairEntity,
  baseY: number,
  levelId?: string,
): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const thicknessM = DEFAULT_LANDING_THICKNESS_MM * MM_TO_M;
  const mat = resolveStairMaterial(stair, 'stair-landing');
  for (const poly of stair.geometry.landings) {
    const shape = shapeFromPolygon(poly);
    if (!shape) continue;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thicknessM, bevelEnabled: false });
    geo.applyMatrix4(ROT_X_NEG_90);
    const mesh = new THREE.Mesh(geo, mat);
    const topZmm = poly[0]!.z;
    mesh.position.y = baseY + topZmm * MM_TO_M;
    out.push(tagMesh(mesh, stair, 'landing', levelId));
  }
  return out;
}

// ── Public converter ─────────────────────────────────────────────────────────

export function stairToMeshes(
  stair: StairEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
): readonly THREE.Mesh[] {
  const baseY = floorElevationMm * MM_TO_M + buildingBaseElevationM;
  return [
    ...buildLandingMeshes(stair, baseY, levelId),
    ...buildTreadMeshes(stair, baseY, levelId),
    ...buildRiserMeshes(stair, baseY, levelId),
    ...buildStringerMeshes(stair, baseY, levelId),
    ...buildHandrailMeshes(stair, baseY, levelId),
  ];
}
