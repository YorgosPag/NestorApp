/**
 * bim-three-shape-helpers — file-private geometry primitives extracted from
 * `BimToThreeConverter.ts` (N.7.1 file-size split, 2026-06-01). Pure functions,
 * ZERO behaviour change: builds THREE.Shape cross-sections from BIM footprints
 * and extrudes/rotates them into Y-up world geometry.
 *
 * Coordinate convention (see BimToThreeConverter header):
 *   DXF plan (mm): X = East, Y = North
 *   Three.js world (m, Y-up): x = East, y = Up, z = -North
 * Build ExtrudeGeometry in the shape's local XY plane, then rotate -π/2 around X
 * so local Z (extrusion) becomes world Y (height).
 */

import * as THREE from 'three';
import type { Point3D } from '../../bim/types/bim-base';

// ── Shared rotation matrix: shape XY → Three.js Y-up ─────────────────────────
const ROT_X_NEG_90 = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

export function toShapePoints(pts: readonly Point3D[]): { x: number; y: number }[] {
  return pts.map((p) => ({ x: p.x, y: p.y }));
}

export function buildShape(outer: readonly Point3D[], inner?: readonly Point3D[]): THREE.Shape | null {
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

export function extrudeAndRotate(shape: THREE.Shape, depthM: number): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: depthM, bevelEnabled: false });
  geo.applyMatrix4(ROT_X_NEG_90);
  return geo;
}

export function tagMesh(mesh: THREE.Mesh, id: string, type: string, matId: string, levelId?: string): THREE.Mesh {
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
export function buildWallShape(outer: readonly Point3D[], inner: readonly Point3D[]): THREE.Shape | null {
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
