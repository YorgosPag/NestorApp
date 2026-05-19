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

// ── Shared rotation matrix: shape XY → Three.js Y-up ─────────────────────────
const ROT_X_NEG_90 = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

// ── Phase 2 flat materials (Phase 3: MaterialCatalog3D) ──────────────────────
const WALL_MAT = new THREE.MeshStandardMaterial({
  color: 0x9e9e9e,
  roughness: 0.8,
  metalness: 0.1,
  side: THREE.DoubleSide,
});

const COLUMN_MAT = new THREE.MeshStandardMaterial({
  color: 0x616161,
  roughness: 0.7,
  metalness: 0.15,
  side: THREE.DoubleSide,
});

const BEAM_MAT = new THREE.MeshStandardMaterial({
  color: 0x795548,
  roughness: 0.75,
  metalness: 0.1,
  side: THREE.DoubleSide,
});

const SLAB_MAT = new THREE.MeshStandardMaterial({
  color: 0xbdbdbd,
  roughness: 0.85,
  metalness: 0.05,
  side: THREE.DoubleSide,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function toShapePoints(pts: readonly Point3D[]): { x: number; y: number }[] {
  return pts.map((p) => ({ x: p.x / 1000, y: p.y / 1000 }));
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

function tagMesh(mesh: THREE.Mesh, id: string, type: string): THREE.Mesh {
  mesh.userData['bimId'] = id;
  mesh.userData['bimType'] = type;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ── Public converters ─────────────────────────────────────────────────────────

export function wallToMesh(wall: WallEntity, floorElevationMm = 0): THREE.Mesh | null {
  const shape = buildShape(
    wall.geometry.outerEdge.points,
    wall.geometry.innerEdge.points,
  );
  if (!shape) return null;

  const geo = extrudeAndRotate(shape, wall.params.height / 1000);
  const mesh = new THREE.Mesh(geo, WALL_MAT);
  mesh.position.y = floorElevationMm / 1000;
  return tagMesh(mesh, wall.id, 'wall');
}

export function columnToMesh(column: ColumnEntity, floorElevationMm = 0): THREE.Mesh | null {
  const verts = column.geometry.footprint.vertices;
  if (verts.length < 3) return null;

  const shape = buildShape(verts);
  if (!shape) return null;

  const geo = extrudeAndRotate(shape, column.params.height / 1000);
  const mesh = new THREE.Mesh(geo, COLUMN_MAT);
  mesh.position.y = floorElevationMm / 1000;
  return tagMesh(mesh, column.id, 'column');
}

export function beamToMesh(beam: BeamEntity): THREE.Mesh | null {
  const verts = beam.geometry.outline.vertices;
  if (verts.length < 3) return null;

  const shape = buildShape(verts);
  if (!shape) return null;

  const depthM = beam.params.depth / 1000;
  const geo = extrudeAndRotate(shape, depthM);
  const mesh = new THREE.Mesh(geo, BEAM_MAT);
  // elevation = top of beam; extrusion goes from y=0 → y=depth, so offset down by depth
  mesh.position.y = (beam.params.elevation - beam.params.depth) / 1000;
  return tagMesh(mesh, beam.id, 'beam');
}

export function slabToMesh(slab: SlabEntity): THREE.Mesh | null {
  const verts = slab.params.outline.vertices;
  if (verts.length < 3) return null;

  const shape = buildShape(verts);
  if (!shape) return null;

  const thicknessM = slab.params.thickness / 1000;
  const geo = extrudeAndRotate(shape, thicknessM);
  const mesh = new THREE.Mesh(geo, SLAB_MAT);
  // elevation = top surface; position bottom at elevation - thickness
  mesh.position.y = (slab.params.elevation - slab.params.thickness) / 1000;
  return tagMesh(mesh, slab.id, 'slab');
}
