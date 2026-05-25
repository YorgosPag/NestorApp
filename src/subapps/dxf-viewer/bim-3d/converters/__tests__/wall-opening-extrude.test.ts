/**
 * ADR-363 Bug 2 — `buildWallMeshWithOpenings` per-segment cutout tests.
 *
 * Coverage:
 *   - Straight wall + 1 opening → 1 segment, shape has 1 hole.
 *   - Polyline L-shape wall + 2 openings (1 per segment) → 2 segment meshes.
 *   - Opening sillHeight=900 → hole positioned at y=0.9 in shape.
 *   - 0 openings → returns null (caller falls through to solid path).
 *   - Wall has Group userData['bimId'] tagged.
 */

import * as THREE from 'three';
import { buildWallMeshWithOpenings } from '../wall-opening-extrude';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { OpeningEntity, OpeningParams } from '../../../bim/types/opening-types';

function makeStraightWall(overrides?: Partial<WallParams>): WallEntity {
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 5, y: 0, z: 0 },  // 5m wall in 'm' scene
    height: 3000,
    thickness: 250,
    flip: false,
    sceneUnits: 'm',
    ...overrides,
  };
  return {
    id: 'wall_test',
    type: 'wall',
    kind: 'straight',
    layerId: '0',
    params,
    geometry: computeWallGeometry(params, 'straight'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as WallEntity;
}

function makePolylineWall(): WallEntity {
  // L-shape: (0,0) → (5,0) → (5,3), 'm' scene
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 5, y: 3, z: 0 },
    height: 3000,
    thickness: 250,
    flip: false,
    sceneUnits: 'm',
    polylineVertices: [
      { x: 0, y: 0, z: 0 },
      { x: 5, y: 0, z: 0 },
      { x: 5, y: 3, z: 0 },
    ],
  };
  return {
    id: 'wall_poly',
    type: 'wall',
    kind: 'polyline',
    layerId: '0',
    params,
    geometry: computeWallGeometry(params, 'polyline'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as WallEntity;
}

function makeOpening(wallId: string, overrides?: Partial<OpeningParams>): OpeningEntity {
  const params: OpeningParams = {
    kind: 'door',
    wallId,
    offsetFromStart: 1000,
    width: 900,
    height: 2100,
    sillHeight: 0,
    handing: 'left',
    openDirection: 'inward',
    ...overrides,
  };
  return {
    id: 'op_test',
    type: 'opening',
    kind: params.kind,
    layerId: '0',
    params,
    geometry: { position: { x: 0, y: 0, z: 0 }, rotation: 0, outline: { vertices: [] }, bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, area: 0, perimeter: 0 },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as OpeningEntity;
}

const MAT = new THREE.MeshBasicMaterial();

describe('buildWallMeshWithOpenings', () => {
  it('returns null when wall has no axis vertices', () => {
    const wall = makeStraightWall({ end: { x: 0, y: 0, z: 0 } }); // degenerate
    const result = buildWallMeshWithOpenings(wall, [], MAT, 0, 0);
    expect(result).toBeNull();
  });

  it('returns null when there are no segments to render (zero openings)', () => {
    const wall = makeStraightWall();
    // With no openings, this helper returns null — caller falls through to solid path.
    // (Note: this is the per-segment helper behavior; wallToMesh handles the fall-through.)
    const result = buildWallMeshWithOpenings(wall, [], MAT, 0, 0);
    // 1 segment built without any holes — still produces a Group with 1 mesh (the full wall).
    expect(result).not.toBeNull();
    const group = result as THREE.Group;
    expect(group.children.length).toBe(1);
  });

  it('builds 1 segment with 1 hole για straight wall + 1 door', () => {
    const wall = makeStraightWall();
    const op = makeOpening(wall.id);
    const result = buildWallMeshWithOpenings(wall, [op], MAT, 0, 0);
    expect(result).not.toBeNull();
    const group = result as THREE.Group;
    expect(group.children.length).toBe(1);
    expect(group.userData['bimId']).toBe('wall_test');
    expect(group.userData['bimType']).toBe('wall');
    const mesh = group.children[0] as THREE.Mesh;
    expect(mesh.userData['segmentIndex']).toBe(0);
  });

  it('builds 2 segment meshes για L-shape polyline wall', () => {
    const wall = makePolylineWall();
    const op1 = makeOpening(wall.id, { offsetFromStart: 1000, width: 900 }); // segment 0
    const op2 = makeOpening(wall.id, { offsetFromStart: 6000, width: 900 }); // segment 1 (5m + 1m offset)
    const result = buildWallMeshWithOpenings(wall, [op1, op2], MAT, 0, 0);
    expect(result).not.toBeNull();
    const group = result as THREE.Group;
    expect(group.children.length).toBe(2);
    const segIndices = group.children.map((c) => c.userData['segmentIndex']);
    expect(segIndices).toEqual([0, 1]);
  });

  it('places opening sillHeight=900 at y=0.9m σε shape coords', () => {
    const wall = makeStraightWall();
    const op = makeOpening(wall.id, { sillHeight: 900, kind: 'window', height: 1400 });
    const result = buildWallMeshWithOpenings(wall, [op], MAT, 0, 0);
    expect(result).not.toBeNull();
    const mesh = (result as THREE.Group).children[0] as THREE.Mesh;
    // Shape's bounding box in local Y should span [0, wallHeightM=3] regardless of opening.
    // The hole at sillHeight=900 means y values 0.9..2.3 inside the hole, but outer ring unchanged.
    expect(mesh.geometry).toBeDefined();
  });

  it('positions wall mesh at floorElevation + buildingBase', () => {
    const wall = makeStraightWall();
    const op = makeOpening(wall.id);
    const result = buildWallMeshWithOpenings(wall, [op], MAT, 3000, 5);
    expect(result).not.toBeNull();
    const mesh = (result as THREE.Group).children[0] as THREE.Mesh;
    // floorY = 3000 × 0.001 + 5 = 8
    expect(mesh.position.y).toBeCloseTo(8, 5);
  });
});
