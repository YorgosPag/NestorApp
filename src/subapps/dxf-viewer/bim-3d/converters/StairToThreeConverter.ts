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
import type { StairEntity, Polygon3D, Polyline3D } from '../../bim/types/stair-types';
import { resolveStairMaterial } from '../materials/stair-material-resolver';
import { resolveTreadNosing } from '../../bim/geometry/stairs/stair-tread-overrides';
import { buildTreadNosingMesh } from './stair-tread-nosing-3d';
import { inferSceneUnitsFromWidth, sceneUnitsToMeters } from '../../utils/scene-units';
import { attachEdgesProjection } from './bim-three-edges';
import { ensureWorldUvs } from './bim-uv-helpers';
import { stampBimIdentity } from './bim-three-shape-helpers';
import { polygonCentroid } from '../../bim/geometry/shared/polygon-utils';
import { DEFAULT_WAIST_SLAB_THICKNESS_MM } from '../../bim/stairs/stair-boq-quantities';
import { buildWaistSlabMeshes } from './stair-waist-slabs';
import {
  buildRiserBox,
  riserAscentDir,
  treadForwardDir,
} from './stair-part-seating-3d';

// ADR-375 Phase C.7 — stair subcategory wiring (ADR-377 SUBCATEGORY_TAXONOMY).
// ADR-377 Phase E — unified onto the shared `attachEdgesProjection` SSoT (was a
// local clone). `category` is always 'stair'; subcategoryKey selects the part
// (treads/risers/outlines). landing has no canonical subcategory key → omit →
// falls back to parent stair style.
function attachStairEdges(mesh: THREE.Mesh, subcategoryKey?: string): void {
  attachEdgesProjection(mesh, 'stair', subcategoryKey);
}

const ROT_X_NEG_90 = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

// Industry defaults (mm absolute) — Revit/ArchiCAD aligned, applied when stair
// lacks explicit values. Converted to meters at use site (× 0.001).
//
// `tread`/`riser` are FINISH thicknesses (a 40 mm timber tread board over the
// structural waist, a 20 mm riser face) — Revit models these as separate run-type
// properties, so they stay independent of the structural depth. The LANDING has NO
// hardcoded thickness: per the Revit "Monolithic Landing → Same as Run" default it
// inherits the run's structural depth (`StairParams.waistThickness`, the μηρός),
// resolved via `resolveLandingThicknessMm`. See ADR-358 changelog (2026-07-21).
const DEFAULT_TREAD_THICKNESS_MM = 40;
const DEFAULT_RISER_THICKNESS_MM = 20;
const DEFAULT_HANDRAIL_RADIUS_MM = 25;
const DEFAULT_HANDRAIL_HEIGHT_MM = 900;
const HANDRAIL_TUBE_SEGMENTS = 8;
const MM_TO_M = 0.001;

// Tread horizontal nudge BACKWARD (away from the nose / down-slope), applied along
// each tread's own ascent axis (Giorgio 2026-07-22). Explicit design offset, not
// tied to a section dim. Net result relative to the plan polygon: 40 mm back.
const TREAD_BACK_SHIFT_MM = 40;

// Waist slab (μηρός) vertical drop toward the building floor (Giorgio 2026-07-22).
// Explicit design offset applied as a world translation on the finished slab mesh.
const WAIST_DROP_MM = 40;

function shapeFromPolygon(poly: Polygon3D, sceneToM: number): THREE.Shape | null {
  if (poly.length < 3) return null;
  const shape = new THREE.Shape();
  const [first, ...rest] = poly;
  shape.moveTo(first.x * sceneToM, first.y * sceneToM);
  for (const p of rest) shape.lineTo(p.x * sceneToM, p.y * sceneToM);
  shape.closePath();
  return shape;
}

/**
 * Build one horizontal extruded slab mesh (tread OR landing) from a flat polygon
 * whose `z` is the walkable TOP-face elevation. ExtrudeGeometry grows local +Z →
 * world +Y after the -90°X rotation, so the mesh occupies `[y, y + thickness]`;
 * we drop it by `thicknessM` to seat the top face at `topZ`. Returns null for a
 * degenerate (<3 vertex) polygon. Shared SSoT for treads + landings (ADR-584).
 */
function extrudeFlatSlab(
  poly: Polygon3D,
  sceneToM: number,
  thicknessM: number,
  mat: THREE.MeshStandardMaterial,
  baseY: number,
): THREE.Mesh | null {
  const shape = shapeFromPolygon(poly, sceneToM);
  if (!shape) return null;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thicknessM, bevelEnabled: false });
  geo.applyMatrix4(ROT_X_NEG_90);
  ensureWorldUvs(geo); // ADR-413 — aoMap uv2.
  const mesh = new THREE.Mesh(geo, mat);
  const topZ = poly[0]!.z * sceneToM;
  mesh.position.y = baseY + topZ - thicknessM;
  return mesh;
}

/**
 * ADR-669 — the stair's identity superset: `stampBimIdentity` SSoT + the stair-only
 * component keys. Deliberately passes NO `matId`: a stair mesh has no single material id
 * (`resolveStairMaterial` resolves per component/tread), and `section-cut-cap-groups`
 * reads `userData.matId` — so the key must stay absent, not empty.
 */
function tagStairMesh(
  mesh: THREE.Mesh,
  stair: StairEntity,
  component: string,
  levelId?: string,
  componentIndex?: number,
): THREE.Mesh {
  stampBimIdentity(mesh, { bimId: stair.id, bimType: 'stair', levelId });
  mesh.userData['stairComponent'] = component;
  // ADR-358 Q19 — per-tread/per-riser sub-element picking (click-into). 0-based index
  // into the component's geometry array; MATCHES `resolveStairMaterial`'s `treadIndex`
  // convention, so a picked tread and its material override read the SAME key.
  if (componentIndex !== undefined) mesh.userData['stairComponentIndex'] = componentIndex;
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
  skipBaseTread = false,
): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const thicknessM = DEFAULT_TREAD_THICKNESS_MM * MM_TO_M;
  // geometry.treads is 2D-cut: only treads below cutPlaneHeight (default 1200mm).
  // For 3D we want all treads regardless of section plane.
  const allTreads = [
    ...stair.geometry.treadsBelowCut,
    ...stair.geometry.treadsAboveCut,
  ];
  // Backward nudge (Giorgio 2026-07-22): each tread slides AWAY from the nose by
  // TREAD_BACK_SHIFT_MM. Direction is per-tread (turn-safe) from adjacent-tread
  // centroids; the shift is a world translation on the finished mesh (geometry
  // bakes world xy, position.xz = 0). `treadForwardDir` gives the nose (ascent)
  // axis; we subtract it to move down-slope.
  const treadBackM = TREAD_BACK_SHIFT_MM * MM_TO_M;
  const riseScene = stair.params.rise;
  const treadInfo = allTreads.map((t) => ({ z: t[0]?.z ?? 0, c: polygonCentroid(t) }));
  // ADR-685 Φ1b (Giorgio 2026-07-22) — when the stair seats on a base slab, the floor
  // finish (tiles) covers the starting step's footprint, so its 40 mm tread finish is
  // redundant. Skip ONLY the base (lowest-z) tread; the riser and every other step stay.
  const baseTreadIndex = skipBaseTread && treadInfo.length > 0
    ? treadInfo.reduce((lo, info, idx) => (info.z < treadInfo[lo]!.z ? idx : lo), 0)
    : -1;
  for (let i = 0; i < allTreads.length; i++) {
    if (i === baseTreadIndex) continue;
    const mat = resolveStairMaterial(stair, 'stair-tread', i);
    // ADR-358 Q19 Φ4b — a per-tread `customProfile` (Revit Nosing Profile) sweeps
    // a shaped nose; without one, `resolveTreadNosing` yields no section and we
    // fall back to the flat slab (the Φ4a square overhang already sits in `poly`).
    const section = resolveTreadNosing(stair.params, i).section;
    const mesh = section
      ? buildTreadNosingMesh(allTreads, i, section, sceneToM, thicknessM, mat, baseY)
        ?? extrudeFlatSlab(allTreads[i]!, sceneToM, thicknessM, mat, baseY)
      : extrudeFlatSlab(allTreads[i]!, sceneToM, thicknessM, mat, baseY);
    if (!mesh) continue;
    const fwd = treadForwardDir(i, treadInfo, riseScene, stair.params.direction);
    if (fwd) {
      mesh.position.x -= fwd.x * treadBackM; // move opposite the nose (down-slope)
      mesh.position.z += fwd.y * treadBackM; // DXF Y → world -Z, negated for backward
    }
    const tagged = tagStairMesh(mesh, stair, 'tread', levelId, i);
    attachStairEdges(tagged, 'treads');
    out.push(tagged);
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
  // Tuck the riser panel UNDER the tread instead of level with it (Giorgio 2026-07-22):
  //   • drop by the tread thickness → riser TOP face meets the tread BOTTOM face.
  //   • pull back by the nosing overhang → riser front sits behind the nose, under
  //     the tread — NOT flush with the tread front edge.
  // Derived from the SSoT dims (tread-slab thickness + `nosing`), never hardcoded,
  // so the seat stays correct if either changes.
  const treadDropM = DEFAULT_TREAD_THICKNESS_MM * MM_TO_M;
  const nosingBackM = (stair.params.nosing ?? 0) * sceneToM;
  const risers = stair.geometry.risers;
  // Tread centroids (scene units) for the flush-seating ascent direction.
  const treadInfo = [...stair.geometry.treadsBelowCut, ...stair.geometry.treadsAboveCut]
    .map((t) => ({ z: t[0]?.z ?? 0, c: polygonCentroid(t) }));
  for (let i = 0; i < risers.length; i++) {
    // ADR-358 Q19 Φ7 — per-riser material override (0-based, matches the `stairComponentIndex` tag).
    const mat = resolveStairMaterial(stair, 'stair-riser', i);
    const ascent = riserAscentDir(risers[i]!, treadInfo);
    const mesh = buildRiserBox(risers[i]!, sceneToM, riseM, thicknessM, mat, baseY, ascent, treadDropM, nosingBackM);
    if (mesh) {
      const tagged = tagStairMesh(mesh, stair, 'riser', levelId, i);
      attachStairEdges(tagged, 'risers');
      out.push(tagged);
    }
  }
  return out;
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
    ensureWorldUvs(geo); // ADR-413 — aoMap uv2 (BoxGeometry auto-UVs).
    const mesh = new THREE.Mesh(geo, mat);
    const midX = (a.x + b.x) * 0.5 * sceneToM;
    const midY = (a.y + b.y) * 0.5 * sceneToM;
    const midZ = (a.z + b.z) * 0.5 * sceneToM;
    mesh.position.set(midX, baseY + midZ - heightM * 0.5, -midY);
    // Orient box length along (a→b) in plan, allowing vertical tilt.
    const dirPlan = Math.atan2(-dyM, dxM); // world rotation around Y
    mesh.rotation.y = dirPlan;
    const tagged = tagStairMesh(mesh, stair, 'stringer', levelId);
    attachStairEdges(tagged, 'outlines');
    out.push(tagged);
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
    if (mesh) out.push(tagStairMesh(mesh, stair, 'handrail-inner', levelId));
  }
  if (hr.outer && stair.geometry.handrails.outer) {
    const mesh = handrailTube(stair.geometry.handrails.outer, sceneToM, radiusM, heightOffsetM, mat, baseY);
    if (mesh) out.push(tagStairMesh(mesh, stair, 'handrail-outer', levelId));
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
  ensureWorldUvs(geo); // ADR-413 — aoMap uv2 (TubeGeometry auto-UVs).
  return new THREE.Mesh(geo, mat);
}

// ── Landings ─────────────────────────────────────────────────────────────────

/**
 * Landing structural depth (meters), Revit "Monolithic Landing → Total Depth" with a
 * "Same as Run" fallback. Precedence:
 *   1. `landingThickness` — the landing's OWN depth (Revit Total Depth), editable
 *      20–400 mm so a thin/timber landing (e.g. 40 mm) is reachable, decoupled from
 *      the RC waist minimum;
 *   2. `waistThickness` — "Same as Run": inherit the run's structural depth (μηρός);
 *   3. `DEFAULT_WAIST_SLAB_THICKNESS_MM` (150 mm) — SSoT default.
 *
 * This also seats the transition riser correctly: the landing slab drops by
 * `thickness` from the top face, so with the 150 mm default < the typical 175 mm rise
 * the slab bottom stays ABOVE the lower tread's top and no longer swallows the riser
 * (the pre-2026-07-21 hardcoded 200 mm > rise buried it). No scene-unit scaling — the
 * thickness fields are absolute mm, matching the tread/riser thickness convention.
 */
function resolveLandingThicknessMm(stair: StairEntity): number {
  const p = stair.params;
  const mm = p.landingThickness ?? p.waistThickness ?? DEFAULT_WAIST_SLAB_THICKNESS_MM;
  return mm * MM_TO_M;
}

function buildLandingMeshes(
  stair: StairEntity,
  baseY: number,
  sceneToM: number,
  levelId?: string,
): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const thicknessM = resolveLandingThicknessMm(stair);
  const mat = resolveStairMaterial(stair, 'stair-landing');
  const landings = stair.geometry.landings;
  for (let i = 0; i < landings.length; i++) {
    // Same convention as treads: poly.z = walkable top face (shared SSoT extrude, ADR-584).
    const mesh = extrudeFlatSlab(landings[i]!, sceneToM, thicknessM, mat, baseY);
    if (!mesh) continue;
    // ADR-637 Φ5 — 0-based index into `geometry.landings` = the `stairComponentIndex`
    // the 2D hit-test, raycaster and sub-element highlighter pick landings by.
    const tagged = tagStairMesh(mesh, stair, 'landing', levelId, i);
    // landing has no canonical subcategory in ADR-377 taxonomy → parent stair style.
    attachStairEdges(tagged);
    out.push(tagged);
  }
  return out;
}

// ── Waist slab (μηρός — monolithic solid body) ───────────────────────────────

/**
 * ADR-358 (2026-07-21) — the inclined structural slab under the steps (Revit
 * "Monolithic Stair"). Pure geometry lives in `stair-waist-slabs.ts`; here we stamp
 * the shared stair identity + edges so it picks/styles like any stair component.
 * Empty for open/stringer structures.
 */
function buildWaistMeshes(
  stair: StairEntity,
  baseY: number,
  sceneToM: number,
  levelId?: string,
  baseSlabUndersideZmm?: number,
): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const waistDropM = WAIST_DROP_MM * MM_TO_M;
  // ADR-685 Φ2 — terminating seat: trim the base flight's soffit at the seating slab's
  // UNDERSIDE so the monolithic waist fills the slab band but never hangs below it (Revit
  // "Join Geometry" parity). `baseSlabUndersideZmm` is level-relative mm (same datum as
  // `basePoint.z`), converted to world via `sceneToM` exactly like the step corners. The
  // clip is pre-compensated by `+waistDropM` so that AFTER the `-= waistDropM` shift below
  // the trimmed flat base lands flush at the slab underside, not one drop beneath it.
  const soffitClipWorldY =
    baseSlabUndersideZmm !== undefined
      ? baseY + baseSlabUndersideZmm * sceneToM + waistDropM
      : undefined;
  for (const mesh of buildWaistSlabMeshes(stair, baseY, sceneToM, soffitClipWorldY)) {
    mesh.position.y -= waistDropM; // lower the slab toward the building floor
    const tagged = tagStairMesh(mesh, stair, 'waist', levelId);
    attachStairEdges(tagged); // no subcategory → parent stair style (like landings)
    out.push(tagged);
  }
  return out;
}

// ── Public converter ─────────────────────────────────────────────────────────

export function stairToMeshes(
  stair: StairEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
  baseSlabUndersideZmm?: number,
): readonly THREE.Mesh[] {
  // SSoT: scene-units inference + Three.js meters conversion live in
  // utils/scene-units.ts. Stair params/geometry are in scene units (m/cm/mm
  // inferred from width magnitude per ADR-358 §9.2 Q22 heuristic).
  const sceneUnits = inferSceneUnitsFromWidth(stair.params.width);
  const sceneToM = sceneUnitsToMeters(sceneUnits);
  const baseY = floorElevationMm * MM_TO_M + buildingBaseElevationM;
  return [
    ...buildWaistMeshes(stair, baseY, sceneToM, levelId, baseSlabUndersideZmm),
    ...buildLandingMeshes(stair, baseY, sceneToM, levelId),
    // Seated on a base slab → the floor finish covers the starting step → skip its tread.
    ...buildTreadMeshes(stair, baseY, sceneToM, levelId, baseSlabUndersideZmm !== undefined),
    ...buildRiserMeshes(stair, baseY, sceneToM, levelId),
    ...buildStringerMeshes(stair, baseY, sceneToM, levelId),
    ...buildHandrailMeshes(stair, baseY, sceneToM, levelId),
  ];
}
