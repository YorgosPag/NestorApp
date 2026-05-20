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
import type { Point3D } from '../../bim/types/bim-base';
import { getMaterial3D, getElementMaterial3D } from '../materials/MaterialCatalog3D';

// ── Shared rotation matrix: shape XY → Three.js Y-up ─────────────────────────
const ROT_X_NEG_90 = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

// ── Wall material: DNA core layer → catalog, else category fallback ───────────
const CATEGORY_MAT_ID: Record<WallEntity['params']['category'], string> = {
  exterior:  'mat-concrete',
  interior:  'mat-plaster',
  partition: 'mat-brick',
  parapet:   'mat-concrete',
  fence:     'mat-stone',
};

function resolveWallMaterial(wall: WallEntity): THREE.MeshStandardMaterial {
  const coreLayer = wall.params.dna?.layers.find((l) => l.side === 'core');
  const materialId = coreLayer?.materialId ?? CATEGORY_MAT_ID[wall.params.category] ?? 'mat-concrete';
  return getMaterial3D(materialId);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// All BIM params (height, depth, thickness, elevation) are in canvas world units (~meters).
// Shape XY coords: same units. No unit conversion needed anywhere in this file.
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

function tagMesh(mesh: THREE.Mesh, id: string, type: string, levelId?: string): THREE.Mesh {
  mesh.userData['bimId'] = id;
  mesh.userData['bimType'] = type;
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

export function wallToMesh(wall: WallEntity, floorElevationMm = 0, levelId?: string): THREE.Mesh | null {
  const shape = buildWallShape(
    wall.geometry.outerEdge.points,
    wall.geometry.innerEdge.points,
  );
  if (!shape) return null;

  const geo = extrudeAndRotate(shape, wall.params.height);
  const mesh = new THREE.Mesh(geo, resolveWallMaterial(wall));
  mesh.position.y = floorElevationMm;
  return tagMesh(mesh, wall.id, 'wall', levelId);
}

export function columnToMesh(column: ColumnEntity, floorElevationMm = 0, levelId?: string): THREE.Mesh | null {
  const verts = column.geometry.footprint.vertices;
  if (verts.length < 3) return null;

  const shape = buildShape(verts);
  if (!shape) return null;

  const geo = extrudeAndRotate(shape, column.params.height);
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('column'));
  mesh.position.y = floorElevationMm;
  return tagMesh(mesh, column.id, 'column', levelId);
}

export function beamToMesh(beam: BeamEntity, levelId?: string): THREE.Mesh | null {
  const verts = beam.geometry.outline.vertices;
  if (verts.length < 3) return null;

  const shape = buildShape(verts);
  if (!shape) return null;

  const geo = extrudeAndRotate(shape, beam.params.depth);
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('beam'));
  // elevation = top of beam; extrusion goes from y=0 → y=depth, so offset down by depth
  mesh.position.y = beam.params.elevation - beam.params.depth;
  return tagMesh(mesh, beam.id, 'beam', levelId);
}

export function slabToMesh(slab: SlabEntity, levelId?: string): THREE.Mesh | null {
  const verts = slab.params.outline.vertices;
  if (verts.length < 3) return null;

  const shape = buildShape(verts);
  if (!shape) return null;

  const geo = extrudeAndRotate(shape, slab.params.thickness);
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('slab'));
  // elevation = top surface; position bottom at elevation - thickness
  mesh.position.y = slab.params.elevation - slab.params.thickness;
  return tagMesh(mesh, slab.id, 'slab', levelId);
}
