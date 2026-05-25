/**
 * BimToThreeConverter — pure functions: BIM entity → THREE.Mesh.
 *
 * ADR-366 Phase 2 (SPEC-3D-002). Coordinate convention:
 *   DXF plan (mm): X = East, Y = North
 *   Three.js world (m, Y-up): x = East, y = Up, z = -North
 *
 * Build ExtrudeGeometry in shape's local XY plane, then rotate -π/2 around X
 * so local Z (extrusion) becomes world Y (height). Shape X → world X, shape Y
 * stays as-is → after rotation becomes world -Z (= DXF North → -Z) ✓.
 *
 * Phase 2 MVP: solid geometry only. Openings as Phase 3 boolean cutout.
 * Phase 3+: material catalog, per-entity override, LOD.
 */

import * as THREE from 'three';
import type { WallEntity } from '../../bim/types/wall-types';
import type { ColumnEntity } from '../../bim/types/column-types';
import type { BeamEntity } from '../../bim/types/beam-types';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { Point3D } from '../../bim/types/bim-base';
import { getMaterial3D, getElementMaterial3D } from '../materials/MaterialCatalog3D';
import { buildWallMeshWithOpenings } from './wall-opening-extrude';

// ── Shared rotation matrix: shape XY → Three.js Y-up ─────────────────────────
const ROT_X_NEG_90 = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

// BIM shape vertices (outerEdge, innerEdge, footprint, outline) are already in meters
// (canvas world coordinates). Scalar params — slab thickness/elevation, beam depth/elevation,
// column height, floorElevationMm — are stored in raw mm and MUST be multiplied by MM_TO_M.
// Exception: wall.params.height is already in meters (wall-completion.ts applies mmToSceneUnits).
const MM_TO_M = 0.001;

// ── Wall material: DNA core layer → catalog, else category fallback ───────────
const CATEGORY_MAT_ID: Record<WallEntity['params']['category'], string> = {
  exterior:  'mat-concrete',
  interior:  'mat-plaster',
  partition: 'mat-brick',
  parapet:   'mat-concrete',
  fence:     'mat-stone',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toShapePoints(pts: readonly Point3D[]): { x: number; y: number }[] {
  return pts.map((p) => ({ x: p.x, y: p.y }));
}

function buildShape(outer: readonly Point3D[], inner?: readonly Point3D[]): THREE.Shape | null {
  if (outer.length < 2) return null;
  const shape = new THREE.Shape();
  const [first, ...rest] = toShapePoints(outer);
  shape.moveTo(first.x, first.y);
  for (const pt of rest) shape.lineTo(pt.x, pt.y);
  shape.closePath();

  if (inner && inner.length >= 2) {
    const hole = new THREE.Path();
    const [h0, ...hRest] = toShapePoints(inner);
    hole.moveTo(h0.x, h0.y);
    for (const pt of hRest) hole.lineTo(pt.x, pt.y);
    hole.closePath();
    shape.holes.push(hole);
  }
  return shape;
}

function extrudeAndRotate(shape: THREE.Shape, depthM: number): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: depthM, bevelEnabled: false });
  geo.applyMatrix4(ROT_X_NEG_90);
  return geo;
}

function tagMesh(mesh: THREE.Mesh, id: string, type: string, matId: string, levelId?: string): THREE.Mesh {
  mesh.userData['bimId'] = id;
  mesh.userData['bimType'] = type;
  mesh.userData['matId'] = matId;
  if (levelId !== undefined) mesh.userData['levelId'] = levelId;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Wall footprint: outerEdge and innerEdge are each open polylines (not closed polygons).
// Combine: trace outer forward → inner backward → close to form a proper solid cross-section.
function buildWallShape(outer: readonly Point3D[], inner: readonly Point3D[]): THREE.Shape | null {
  if (outer.length < 2 || inner.length < 2) return null;
  const outerPts = toShapePoints(outer);
  const innerPts = toShapePoints(inner);
  const shape = new THREE.Shape();
  shape.moveTo(outerPts[0].x, outerPts[0].y);
  for (let i = 1; i < outerPts.length; i++) shape.lineTo(outerPts[i].x, outerPts[i].y);
  for (let i = innerPts.length - 1; i >= 0; i--) shape.lineTo(innerPts[i].x, innerPts[i].y);
  shape.closePath();
  return shape;
}

// ── Public converters ─────────────────────────────────────────────────────────

export function wallToMesh(
  wall: WallEntity,
  openings: readonly OpeningEntity[] = [],
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Object3D | null {
  const coreLayer = wall.params.dna?.layers.find((l) => l.side === 'core');
  const matId = coreLayer?.materialId ?? CATEGORY_MAT_ID[wall.params.category] ?? 'mat-concrete';
  const material = getMaterial3D(matId);

  // ADR-363 Bug 2 — opening cutouts via per-segment front-face re-extrude.
  // Mirror του ADR-370 Phase 7 slab-opening pattern, εξαπλωμένο σε όλα τα
  // wall kinds (straight / curved / polyline) μέσω axis vertex iteration.
  if (openings.length > 0) {
    const group = buildWallMeshWithOpenings(
      wall,
      openings,
      material,
      floorElevationMm,
      buildingBaseElevationM,
    );
    if (group) {
      group.userData['matId'] = matId;
      if (levelId !== undefined) group.userData['levelId'] = levelId;
      return group;
    }
    // Fall through to solid path if segmenting failed (defensive).
  }

  const shape = buildWallShape(
    wall.geometry.outerEdge.points,
    wall.geometry.innerEdge.points,
  );
  if (!shape) return null;

  const geo = extrudeAndRotate(shape, wall.params.height * MM_TO_M);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = floorElevationMm * MM_TO_M + buildingBaseElevationM;
  return tagMesh(mesh, wall.id, 'wall', matId, levelId);
}

export function columnToMesh(
  column: ColumnEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Mesh | null {
  const verts = column.geometry.footprint.vertices;
  if (verts.length < 3) return null;

  const shape = buildShape(verts);
  if (!shape) return null;

  const geo = extrudeAndRotate(shape, column.params.height * MM_TO_M);
  const matId = column.params.material ?? 'elem-column';
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('column'));
  mesh.position.y = floorElevationMm * MM_TO_M + buildingBaseElevationM;
  return tagMesh(mesh, column.id, 'column', matId, levelId);
}

export function beamToMesh(
  beam: BeamEntity,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Mesh | null {
  const verts = beam.geometry.outline.vertices;
  if (verts.length < 3) return null;

  const shape = buildShape(verts);
  if (!shape) return null;

  const beamDepthM = beam.params.depth * MM_TO_M;
  const geo = extrudeAndRotate(shape, beamDepthM);
  const matId = beam.params.material ?? 'elem-beam';
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('beam'));
  // ADR-369 §2.2: topElevation = top of beam; extrusion goes from y=0 → y=depthM.
  // beam hangs DOWN from (topElevation + zOffset) by depth.
  const beamTopMm = beam.params.topElevation + (beam.params.zOffset ?? 0);
  mesh.position.y = beamTopMm * MM_TO_M - beamDepthM + buildingBaseElevationM;
  return tagMesh(mesh, beam.id, 'beam', matId, levelId);
}

// ADR-363 §11.Q3 Phase 3.7d + ADR-370 §6 Phase 7 — slab-opening cutouts.
// THREE.Shape.holes requires opposite winding from the outer ring (CCW outer +
// CW holes — clipper-style). BIM polygons are CCW by convention, so we reverse
// each opening's outline before pushing as a THREE.Path. ExtrudeGeometry runs
// native ear-clipping triangulation with holes, mirroring IFC IfcOpeningElement
// voiding IfcSlab (Revit Floor + Opening family pattern).
function pushHoles(shape: THREE.Shape, openings: readonly SlabOpeningEntity[]): void {
  for (const op of openings) {
    const verts = op.params.outline.vertices;
    if (verts.length < 3) continue;
    const path = new THREE.Path();
    // CCW → CW: traverse vertices in reverse.
    const last = verts[verts.length - 1];
    path.moveTo(last.x, last.y);
    for (let i = verts.length - 2; i >= 0; i--) path.lineTo(verts[i].x, verts[i].y);
    path.closePath();
    shape.holes.push(path);
  }
}

export function slabToMesh(
  slab: SlabEntity,
  openings: readonly SlabOpeningEntity[] = [],
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Mesh | null {
  const verts = slab.params.outline.vertices;
  if (verts.length < 3) return null;

  const shape = buildShape(verts);
  if (!shape) return null;
  pushHoles(shape, openings);

  const thicknessM = slab.params.thickness * MM_TO_M;
  const geo = extrudeAndRotate(shape, thicknessM);
  const matId = slab.params.material ?? 'elem-slab';
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('slab'));
  // ADR-369 §2.1: levelElevation = top face (FFL). Slab hangs DOWN by thickness.
  // floor:0 → -0.20..0m, ceiling/roof:3000 → 2.80..3.00m, foundation:0 → -0.50..0m.
  const slabTopMm = slab.params.levelElevation + (slab.params.heightOffsetFromLevel ?? 0);
  mesh.position.y = (slabTopMm - slab.params.thickness) * MM_TO_M + buildingBaseElevationM;
  return tagMesh(mesh, slab.id, 'slab', matId, levelId);
}
