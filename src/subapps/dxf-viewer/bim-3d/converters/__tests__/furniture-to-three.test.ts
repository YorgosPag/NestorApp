/**
 * ADR-410 — furniture-to-three converter unit tests (units-safe + cache paths).
 *
 * The glTF cache is mocked so the converter is tested in isolation (no Firebase
 * Storage, no GLTFLoader network) — we drive the hit / miss branches directly.
 */

import * as THREE from 'three';

const getInstance = jest.fn();
const preload = jest.fn();
jest.mock('../../library/bim-mesh-library/bim-mesh-cache', () => ({
  bimMeshCache: {
    getInstance: (...a: unknown[]) => getInstance(...a),
    preload: (...a: unknown[]) => preload(...a),
    getSilhouette: jest.fn(),
    getTopEdges: jest.fn(),
  },
}));

import { furnitureToObject3D } from '../furniture-to-three';
import { computeFurnitureGeometry } from '../../../bim/furniture/furniture-geometry';
import { createFurniture } from '@/services/factories/furniture.factory';
import type { FurnitureParams } from '../../../bim/types/furniture-types';

function makeEntity(overrides: Partial<FurnitureParams> = {}) {
  const params: FurnitureParams = {
    kind: 'chair',
    assetId: 'chair_01',
    position: { x: 1000, y: 2000, z: 0 },
    rotationDeg: 0,
    widthMm: 500,
    depthMm: 520,
    heightMm: 900,
    mountingElevationMm: 0,
    sceneUnits: 'mm',
    ...overrides,
  };
  return createFurniture({ params, geometry: computeFurnitureGeometry(params), layerId: 'L0' });
}

beforeEach(() => {
  getInstance.mockReset();
  preload.mockReset();
});

describe('furnitureToObject3D — cache miss (placeholder)', () => {
  it('returns a bbox placeholder and kicks off the async load', () => {
    getInstance.mockReturnValue(null);
    const obj = furnitureToObject3D(makeEntity(), 0, 'L0', 0);
    expect(obj).toBeInstanceOf(THREE.Mesh);
    expect(preload).toHaveBeenCalledWith('furniture', 'chair_01');
    expect(obj?.userData['bimType']).toBe('furniture');
  });

  it('places the placeholder at the plan position in meters (mm scene)', () => {
    getInstance.mockReturnValue(null);
    const obj = furnitureToObject3D(makeEntity(), 0, 'L0', 0)!;
    // plan (1000,2000) mm → world (1, *, -2) m ; base on floor, box centre at h/2.
    expect(obj.position.x).toBeCloseTo(1.0, 5);
    expect(obj.position.z).toBeCloseTo(-2.0, 5);
    expect(obj.position.y).toBeCloseTo(0.45, 5); // 900mm/2 = 0.45m
  });

  it('is units-safe: a meter scene does NOT multiply position by 1000', () => {
    getInstance.mockReturnValue(null);
    const obj = furnitureToObject3D(makeEntity({ sceneUnits: 'm', position: { x: 1, y: 2, z: 0 } }), 0, 'L0', 0)!;
    expect(obj.position.x).toBeCloseTo(1.0, 5);
    expect(obj.position.z).toBeCloseTo(-2.0, 5);
  });
});

describe('furnitureToObject3D — cache hit (real mesh)', () => {
  it('clones the template and applies placement transform + scale', () => {
    const template = new THREE.Group();
    getInstance.mockReturnValue(template);
    const obj = furnitureToObject3D(makeEntity({ rotationDeg: 90, scaleOverride: 2 }), 0, 'L0', 0)!;
    expect(obj).toBe(template);
    expect(preload).not.toHaveBeenCalled();
    expect(obj.position.x).toBeCloseTo(1.0, 5);
    expect(obj.position.z).toBeCloseTo(-2.0, 5);
    expect(obj.position.y).toBeCloseTo(0, 5); // glTF base sits on the floor
    expect(obj.scale.x).toBeCloseTo(2, 5);
    expect(obj.rotation.y).toBeCloseTo(-Math.PI / 2, 5); // -90° (plan CCW → world CW)
  });
});
