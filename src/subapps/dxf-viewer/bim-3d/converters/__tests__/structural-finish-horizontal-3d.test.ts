/**
 * ADR-449 Slice 11 — structural-finish-horizontal-3d tests.
 *
 * Καλύπτει: faces → group με πλάκες, position.y up (στη δομική όψη) vs down (πάχος κάτω),
 * μη-pickable (derived διακόσμηση), holes → ExtrudeGeometry, κενό → null.
 */

import * as THREE from 'three';
import { buildHorizontalFinishSkin } from '../structural-finish-horizontal-3d';
import type { HorizontalFinishFace } from '../../../bim/finishes/structural-finish-horizontal';

const square = (s: number) => [
  { x: 0, y: 0 }, { x: s, y: 0 }, { x: s, y: s }, { x: 0, y: s },
];

const upFace: HorizontalFinishFace = {
  polygons: [{ outer: square(0.5), holes: [] }],
  zMm: 3000, thicknessMm: 15, direction: 'up', classification: 'interior',
  materialId: 'mat-plaster-int', areaM2: 0.25,
};

const downFace: HorizontalFinishFace = {
  polygons: [{ outer: square(0.5), holes: [] }],
  zMm: 2500, thicknessMm: 15, direction: 'down', classification: 'interior',
  materialId: 'mat-plaster-int', areaM2: 0.25,
};

describe('buildHorizontalFinishSkin', () => {
  it('κενά faces → null', () => {
    expect(buildHorizontalFinishSkin([], 'column', 0, 'm')).toBeNull();
  });

  it('up face → group με 1 mesh, base y = z (building base + z)', () => {
    const group = buildHorizontalFinishSkin([upFace], 'column', 10, 'm');
    expect(group).not.toBeNull();
    const meshes = group!.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh);
    expect(meshes).toHaveLength(1);
    // up → base y = buildingBaseElevationM(10) + zMm·0.001(3) = 13
    expect(meshes[0].position.y).toBeCloseTo(13, 6);
    expect(meshes[0].userData['structuralFinish']).toBe(true);
    expect(meshes[0].userData['bimType']).toBe('column');
  });

  it('down face → base y = z − thickness (πλάκα κρέμεται κάτω)', () => {
    const group = buildHorizontalFinishSkin([downFace], 'beam', 0, 'm');
    const mesh = group!.children.find((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh)!;
    // down → base y = 0 + (2500 − 15)·0.001 = 2.485
    expect(mesh.position.y).toBeCloseTo(2.485, 6);
  });

  it('μη-pickable (raycast no-op → μηδέν intersections)', () => {
    const group = buildHorizontalFinishSkin([upFace], 'column', 0, 'm')!;
    const ray = new THREE.Raycaster();
    ray.set(new THREE.Vector3(0.25, 100, -0.25), new THREE.Vector3(0, -1, 0));
    expect(ray.intersectObject(group, true)).toHaveLength(0);
  });

  it('polygon με hole → έγκυρη geometry (μη-κενή)', () => {
    const holed: HorizontalFinishFace = {
      ...upFace,
      polygons: [{ outer: square(1), holes: [[
        { x: 0.4, y: 0.4 }, { x: 0.6, y: 0.4 }, { x: 0.6, y: 0.6 }, { x: 0.4, y: 0.6 },
      ]] }],
    };
    const group = buildHorizontalFinishSkin([holed], 'column', 0, 'm')!;
    const mesh = group.children.find((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh)!;
    expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
  });
});
