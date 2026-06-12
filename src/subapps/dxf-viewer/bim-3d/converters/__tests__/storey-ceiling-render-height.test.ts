/**
 * ADR-448 Phase 1b — storey-ceiling render height.
 *
 * A `topBinding='storey-ceiling'` wall/column renders to the storey ceiling
 * (`nominalHeightMm`, Revit «Top: Up to Level») instead of its stored
 * `params.height`. Pins: (1) the override changes the extruded Y extent,
 * (2) it is a strict no-op when `nominalHeightMm` === `params.height` or absent.
 */

import * as THREE from 'three';
import { wallToMesh, columnToMesh } from '../BimToThreeConverter';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import { buildDefaultColumnParams, buildColumnEntity } from '../../../hooks/drawing/column-completion';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { ColumnEntity } from '../../../bim/types/column-types';

const MM_TO_M = 1 / 1000;

/** Y extent (height, metres) of a built mesh/group. */
function heightM(obj: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(obj);
  return box.max.y - box.min.y;
}

function flatWall(): WallEntity {
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 5, y: 0, z: 0 },
    height: 3000,
    thickness: 250,
    flip: false,
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
    sceneUnits: 'm',
  };
  return {
    id: 'wall_h', type: 'wall', kind: 'straight', layerId: '0', params,
    geometry: computeWallGeometry(params, 'straight'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as WallEntity;
}

function flatColumn(): ColumnEntity {
  const res = buildColumnEntity(buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), '0');
  if (!res.ok) throw new Error('column fixture invalid');
  return res.entity;
}

describe('wallToMesh — storey-ceiling render height (ADR-448 1b)', () => {
  it('extrudes to nominalHeightMm when it exceeds params.height', () => {
    const mesh = wallToMesh(flatWall(), [], 0, '0', 0, undefined, undefined, undefined, 4000);
    expect(heightM(mesh as THREE.Object3D)).toBeCloseTo(4, 2);
  });

  it('no-op when nominalHeightMm === params.height', () => {
    const mesh = wallToMesh(flatWall(), [], 0, '0', 0, undefined, undefined, undefined, 3000);
    expect(heightM(mesh as THREE.Object3D)).toBeCloseTo(3, 2);
  });

  it('falls back to params.height when nominalHeightMm absent (legacy)', () => {
    const mesh = wallToMesh(flatWall(), [], 0, '0', 0);
    expect(heightM(mesh as THREE.Object3D)).toBeCloseTo(3, 2);
  });
});

describe('columnToMesh — storey-ceiling render height (ADR-448 1b)', () => {
  it('extrudes to nominalHeightMm when it exceeds params.height', () => {
    const base = columnToMesh(flatColumn(), 0, '0', 0);
    const tall = columnToMesh(flatColumn(), 0, '0', 0, undefined, undefined, 4000);
    expect(heightM(tall as THREE.Object3D)).toBeCloseTo(4, 2);
    expect(heightM(tall as THREE.Object3D)).toBeGreaterThan(heightM(base as THREE.Object3D));
  });

  it('falls back to params.height when nominalHeightMm absent (legacy)', () => {
    const base = columnToMesh(flatColumn(), 0, '0', 0);
    const same = columnToMesh(flatColumn(), 0, '0', 0, undefined, undefined, undefined);
    expect(heightM(same as THREE.Object3D)).toBeCloseTo(heightM(base as THREE.Object3D), 5);
  });
});
