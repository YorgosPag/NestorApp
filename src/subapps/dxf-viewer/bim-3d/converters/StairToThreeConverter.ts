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
import { inferSceneUnitsFromWidth, sceneUnitsToMeters } from '../../utils/scene-units';

const ROT_X_NEG_90 = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

// Industry defaults (mm absolute) — Revit/ArchiCAD aligned, applied when stair
// lacks explicit values. Converted to meters at use site (× 0.001).
const DEFAULT_TREAD_THICKNESS_MM = 40;
const DEFAULT_RISER_THICKNESS_MM = 20;
const DEFAULT_LANDING_THICKNESS_MM = 200;
const DEFAULT_HANDRAIL_RADIUS_MM = 25;
const DEFAULT_HANDRAIL_HEIGHT_MM = 900;
const HANDRAIL_TUBE_SEGMENTS = 8;
const MM_TO_M = 0.001;

function shapeFromPolygon(poly: Polygon3D, sceneToM: number): THREE.Shape | null {
  if (poly.length < 3) return null;
  const shape = new THREE.Shape();
  const [first, ...rest] = poly;
  shape.moveTo(first.x * sceneToM, first.y * sceneToM);
  for (const p of rest) shape.lineTo(p.x * sceneToM, p.y * sceneToM);
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
  sceneToM: number,
  levelId?: string,
): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const thicknessM = DEFAULT_TREAD_THICKNESS_MM * MM_TO_M;
  // geometry.treads is 2D-cut: only treads below cutPlaneHeight (default 1200mm).
  // For 3D we want all treads regardless of section plane.
  const allTreads = [
    ...stair.geometry.treadsBelowCut,
    ...stair.geometry.treadsAboveCut,
  ];
  for (let i = 0; i < allTreads.length; i++) {
    const poly = allTreads[i]!;
    const shape = shapeFromPolygon(poly, sceneToM);
    if (!shape) continue;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thicknessM, bevelEnabled: false });
    geo.applyMatrix4(ROT_X_NEG_90);
    const mat = resolveStairMaterial(stair, 'stair-tread', i);
    const mesh = new THREE.Mesh(geo, mat);
    // Polygon z = top-face elevation (walkable surface). ExtrudeGeometry extrudes
    // in local +Z; after -90° X rotation this becomes world +Y. So mesh occupies
    // [position.y, position.y + thicknessM]. To put the top face at topZ we
    // translate the mesh DOWN by thicknessM.
    const topZ = poly[0]!.z * sceneToM;
    mesh.position.y = baseY + topZ - thicknessM;
    out.push(tagMesh(mesh, stair, 'tread', levelId));
  }
  return out;
}

// ── Risers (closed type only) ────────────────────────────────────────────────

function buildRiserMeshes(
  stair: StairEntity,
  baseY: number,
  sceneToM: number,
  levelId?: string,
): THREE.Mesh[] {
  if (stair.params.riserType !== 'closed') return [];
  const out: THREE.Mesh[] = [];
  const riseM = stair.params.rise * sceneToM;
  const thicknessM = DEFAULT_RISER_THICKNESS_MM * MM_TO_M;
  const mat = resolveStairMaterial(stair, 'stair-riser');
  for (const seg of stair.geometry.risers) {
    const mesh = buildRiserBox(seg, sceneToM, riseM, thicknessM, mat, baseY);
    if (mesh) out.push(tagMesh(mesh, stair, 'riser', levelId));
  }
  return out;
}

function buildRiserBox(
  seg: Segment3D,
  sceneToM: number,
  riseM: number,
  thicknessM: number,
  mat: THREE.MeshStandardMaterial,
  baseY: number,
): THREE.Mesh | null {
  // ADR-370 Phase 5.3 (2026-05-25) — riser Segment3D uses DIAGONAL encoding:
  // start = corner A @zLow on one width edge, end = OPPOSITE corner B @zHigh
  // on the other width edge. The xy diagonal yields midpoint, width axis, and
  // width magnitude — no need to consult `stair.params.direction/width`.
  const dxScene = seg.end.x - seg.start.x;
  const dyScene = seg.end.y - seg.start.y;
  const widthScene = Math.hypot(dxScene, dyScene);
  if (widthScene < 1e-9) return null; // degenerate (zero-width riser)
  const widthM = widthScene * sceneToM;
  const midXScene = (seg.start.x + seg.end.x) * 0.5;
  const midYScene = (seg.start.y + seg.end.y) * 0.5;
  const geo = new THREE.BoxGeometry(thicknessM, riseM, widthM);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(
    midXScene * sceneToM,
    baseY + (seg.start.z + seg.end.z) * 0.5 * sceneToM,
    -midYScene * sceneToM, // DXF Y → world -Z
  );
  // BoxGeometry width axis = local +Z. Three.js Y-rotation by θ maps (0,0,1) →
  // (sin θ, 0, cos θ). Target world XZ direction = (dxScene, -dyScene)/widthScene
  // (DXF Y → world -Z). Solve: sin θ = dxScene/W, cos θ = -dyScene/W
  // ⇒ θ = atan2(dxScene, -dyScene).
  mesh.rotation.y = Math.atan2(dxScene, -dyScene);
  return mesh;
}

// ── Stringers ─────────────────────────────────────────────────────────────────

function buildStringerMeshes(
  stair: StairEntity,
  baseY: number,
  sceneToM: number,
  levelId?: string,
): THREE.Mesh[] {
  const allowed = new Set(['stringer-1side', 'stringer-2side', 'central-stringer']);
  if (!allowed.has(stair.params.structureType)) return [];
  const sp = stair.params.stringerParams;
  if (!sp) return [];
  const widthM = sp.width * sceneToM;
  const heightM = sp.height * sceneToM;
  const mat = resolveStairMaterial(stair, 'stair-stringer');
  const meshes: THREE.Mesh[] = [];
  const inner = stair.geometry.stringers.inner;
  const outer = stair.geometry.stringers.outer;
  if (inner.length >= 2) meshes.push(...stringerSegmentsAlong(inner, sceneToM, widthM, heightM, mat, baseY, stair, levelId));
  if (outer.length >= 2) meshes.push(...stringerSegmentsAlong(outer, sceneToM, widthM, heightM, mat, baseY, stair, levelId));
  return meshes;
}

function stringerSegmentsAlong(
  poly: Polyline3D,
  sceneToM: number,
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
    const dxM = (b.x - a.x) * sceneToM;
    const dyM = (b.y - a.y) * sceneToM;
    const dzM = (b.z - a.z) * sceneToM;
    const lengthM = Math.hypot(dxM, dyM, dzM);
    if (lengthM < 1e-6) continue;
    const geo = new THREE.BoxGeometry(lengthM, heightM, widthM);
    const mesh = new THREE.Mesh(geo, mat);
    const midX = (a.x + b.x) * 0.5 * sceneToM;
    const midY = (a.y + b.y) * 0.5 * sceneToM;
    const midZ = (a.z + b.z) * 0.5 * sceneToM;
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
  sceneToM: number,
  levelId?: string,
): THREE.Mesh[] {
  const hr = stair.params.handrails;
  if (!hr.inner && !hr.outer) return [];
  const out: THREE.Mesh[] = [];
  const radiusM = DEFAULT_HANDRAIL_RADIUS_MM * MM_TO_M;
  // handrails.height is stored in stair scene units (same convention as width).
  const heightOffsetM = (hr.height ?? DEFAULT_HANDRAIL_HEIGHT_MM) * sceneToM;
  const mat = resolveStairMaterial(stair, 'stair-handrail');
  if (hr.inner && stair.geometry.handrails.inner) {
    const mesh = handrailTube(stair.geometry.handrails.inner, sceneToM, radiusM, heightOffsetM, mat, baseY);
    if (mesh) out.push(tagMesh(mesh, stair, 'handrail-inner', levelId));
  }
  if (hr.outer && stair.geometry.handrails.outer) {
    const mesh = handrailTube(stair.geometry.handrails.outer, sceneToM, radiusM, heightOffsetM, mat, baseY);
    if (mesh) out.push(tagMesh(mesh, stair, 'handrail-outer', levelId));
  }
  return out;
}

function handrailTube(
  polyline: Polyline3D,
  sceneToM: number,
  radiusM: number,
  heightOffsetM: number,
  mat: THREE.MeshStandardMaterial,
  baseY: number,
): THREE.Mesh | null {
  if (polyline.length < 2) return null;
  const points: THREE.Vector3[] = polyline.map(
    (p) => new THREE.Vector3(
      p.x * sceneToM,
      baseY + p.z * sceneToM + heightOffsetM,
      -p.y * sceneToM,
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
  sceneToM: number,
  levelId?: string,
): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const thicknessM = DEFAULT_LANDING_THICKNESS_MM * MM_TO_M;
  const mat = resolveStairMaterial(stair, 'stair-landing');
  for (const poly of stair.geometry.landings) {
    const shape = shapeFromPolygon(poly, sceneToM);
    if (!shape) continue;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thicknessM, bevelEnabled: false });
    geo.applyMatrix4(ROT_X_NEG_90);
    const mesh = new THREE.Mesh(geo, mat);
    // Same convention as treads: poly.z = walkable top face. Translate DOWN.
    const topZ = poly[0]!.z * sceneToM;
    mesh.position.y = baseY + topZ - thicknessM;
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
  // SSoT: scene-units inference + Three.js meters conversion live in
  // utils/scene-units.ts. Stair params/geometry are in scene units (m/cm/mm
  // inferred from width magnitude per ADR-358 §9.2 Q22 heuristic).
  const sceneUnits = inferSceneUnitsFromWidth(stair.params.width);
  const sceneToM = sceneUnitsToMeters(sceneUnits);
  const baseY = floorElevationMm * MM_TO_M + buildingBaseElevationM;
  return [
    ...buildLandingMeshes(stair, baseY, sceneToM, levelId),
    ...buildTreadMeshes(stair, baseY, sceneToM, levelId),
    ...buildRiserMeshes(stair, baseY, sceneToM, levelId),
    ...buildStringerMeshes(stair, baseY, sceneToM, levelId),
    ...buildHandrailMeshes(stair, baseY, sceneToM, levelId),
  ];
}
