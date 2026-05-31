/**
 * ADR-402 — vertical move reflection: `baseOffset` lifts the wall / column mesh in 3D.
 *
 * The flat solid path of `wallToMesh` / `columnToMesh` historically ignored
 * `baseOffset` (only storey FFL + building base drove `mesh.position.y`), so a
 * vertical (axis-Y) move had no visible effect. These tests pin that the flat path
 * now adds `baseOffset` (mm → m) to the Y placement, and that baseOffset=0 is a no-op.
 */

import * as THREE from 'three';
import { wallToMesh, columnToMesh } from '../BimToThreeConverter';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import { buildDefaultColumnParams, buildColumnEntity } from '../../../hooks/drawing/column-completion';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { ColumnEntity } from '../../../bim/types/column-types';

const MM_TO_M = 1 / 1000;

function flatWall(baseOffset: number): WallEntity {
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 5, y: 0, z: 0 }, // 5m wall, 'm' scene
    height: 3000,
    thickness: 250,
    flip: false,
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset,
    topOffset: 0,
    sceneUnits: 'm',
  };
  return {
    id: 'wall_bo',
    type: 'wall',
    kind: 'straight',
    layerId: '0',
    params,
    geometry: computeWallGeometry(params, 'straight'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as WallEntity;
}

function flatColumn(baseOffset: number): ColumnEntity {
  const params = { ...buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), baseOffset };
  const res = buildColumnEntity(params, '0');
  if (!res.ok) throw new Error('column fixture invalid');
  return res.entity;
}

describe('wallToMesh — baseOffset → mesh.position.y (ADR-402 vertical move)', () => {
  it('baseOffset=0 → no lift (storey FFL only)', () => {
    const mesh = wallToMesh(flatWall(0), [], 0, '0', 0);
    expect(mesh).not.toBeNull();
    expect((mesh as THREE.Object3D).position.y).toBeCloseTo(0, 6);
  });

  it('baseOffset=500mm → wall lifts 0.5m', () => {
    const mesh = wallToMesh(flatWall(500), [], 0, '0', 0);
    expect((mesh as THREE.Object3D).position.y).toBeCloseTo(500 * MM_TO_M, 6);
  });

  it('baseOffset stacks on storey FFL + building base', () => {
    const mesh = wallToMesh(flatWall(500), [], 1000 /*FFL mm*/, '0', 2 /*building base m*/);
    expect((mesh as THREE.Object3D).position.y).toBeCloseTo((1000 + 500) * MM_TO_M + 2, 6);
  });
});

describe('columnToMesh — baseOffset → mesh.position.y (ADR-402 vertical move)', () => {
  it('baseOffset=0 → no lift', () => {
    const mesh = columnToMesh(flatColumn(0), 0, '0', 0);
    expect(mesh).not.toBeNull();
    expect((mesh as THREE.Object3D).position.y).toBeCloseTo(0, 6);
  });

  it('baseOffset=750mm → column lifts 0.75m', () => {
    const mesh = columnToMesh(flatColumn(750), 0, '0', 0);
    expect((mesh as THREE.Object3D).position.y).toBeCloseTo(750 * MM_TO_M, 6);
  });
});
