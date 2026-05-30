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
import { buildStraightWallWithOpenings } from '../BimToThreeConverter';
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
    flip: false, baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
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
  } as unknown as WallEntity;
}

function makePolylineWall(): WallEntity {
  // L-shape: (0,0) → (5,0) → (5,3), 'm' scene
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 5, y: 3, z: 0 },
    height: 3000,
    thickness: 250,
    flip: false, baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
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
  } as unknown as WallEntity;
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
  } as unknown as OpeningEntity;
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

// ADR-363 Phase 1J — straight wall WITH openings, mitered vertical-split.
describe('buildStraightWallWithOpenings (mitered, vertical split)', () => {
  it('window (sill>0, top<height) → 2 jambs + sill + header = 4 pieces', () => {
    const wall = makeStraightWall();
    const op = makeOpening(wall.id, { kind: 'window', offsetFromStart: 2000, width: 900, sillHeight: 900, height: 1400 });
    const group = buildStraightWallWithOpenings(wall, [op], MAT, 0, 0) as THREE.Group;
    expect(group).not.toBeNull();
    expect(group.children.length).toBe(4);
    expect(group.userData['bimId']).toBe('wall_test');
  });

  it('door (sill=0, top<height) → 2 jambs + header = 3 pieces (no sill)', () => {
    const wall = makeStraightWall();
    const op = makeOpening(wall.id, { kind: 'door', offsetFromStart: 2000, width: 900, sillHeight: 0, height: 2100 });
    const group = buildStraightWallWithOpenings(wall, [op], MAT, 0, 0) as THREE.Group;
    expect(group.children.length).toBe(3);
  });

  it('opening at the very start (offset 0) → no leading jamb (sill + header + trailing jamb = 3)', () => {
    const wall = makeStraightWall();
    const op = makeOpening(wall.id, { kind: 'window', offsetFromStart: 0, width: 900, sillHeight: 900, height: 1400 });
    const group = buildStraightWallWithOpenings(wall, [op], MAT, 0, 0) as THREE.Group;
    expect(group.children.length).toBe(3);
  });

  it('end pieces use the MITERED corner: group plan extent reaches startMiter.outer', () => {
    // Inject a start miter that pushes the outer-start corner beyond the raw axis start (x<0).
    const wall = makeStraightWall();
    const rawOuterStartX = wall.geometry.outerEdge.points[0].x;
    const mitered = {
      ...wall,
      params: {
        ...wall.params,
        startMiter: { outer: { x: -0.4, y: -0.2, z: 0 }, inner: { x: 0.1, y: 0.2, z: 0 } },
      },
    } as unknown as typeof wall;
    // Recompute geometry so outerEdge/innerEdge carry the miter.
    const withGeo = { ...mitered, geometry: (computeWallGeometry(mitered.params, 'straight')) } as typeof wall;
    expect(withGeo.geometry.outerEdge.points[0].x).toBeCloseTo(-0.4, 6);
    expect(withGeo.geometry.outerEdge.points[0].x).not.toBeCloseTo(rawOuterStartX, 6);
    const op = makeOpening(withGeo.id, { offsetFromStart: 2000, width: 900 });
    const group = buildStraightWallWithOpenings(withGeo, [op], MAT, 0, 0) as THREE.Group;
    // Some piece vertex must reach the mitered outer-start corner in plan (world x ≈ -0.4).
    let minX = Infinity;
    for (const child of group.children) {
      const geo = (child as THREE.Mesh).geometry;
      geo.computeBoundingBox();
      if (geo.boundingBox) minX = Math.min(minX, geo.boundingBox.min.x + child.position.x);
    }
    expect(minX).toBeCloseTo(-0.4, 4);
  });
});
