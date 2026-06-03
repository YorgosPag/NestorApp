/**
 * ADR-411 — mesh-to-object3d unit tests (units-safe + anchor base/top + cache).
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

import { meshToObject3D, type MeshPlacement } from '../mesh-to-object3d';

function placement(overrides: Partial<MeshPlacement> = {}): MeshPlacement {
  return {
    category: 'light-fixture',
    assetId: 'pendant_lamp_01',
    bimId: 'mepfix_1',
    bimType: 'mep-fixture',
    matId: 'elem-mep-fixture',
    position: { x: 1000, y: 2000 },
    rotationDeg: 0,
    scale: 1,
    widthMm: 300,
    depthMm: 300,
    heightMm: 400,
    sceneUnits: 'mm',
    floorElevationMm: 0,
    mountingElevationMm: 2700,
    verticalAnchor: 'top',
    buildingBaseElevationM: 0,
    ...overrides,
  };
}

beforeEach(() => {
  getInstance.mockReset();
  preload.mockReset();
});

describe('meshToObject3D — cache miss (placeholder)', () => {
  it('returns a bbox placeholder, kicks off preload(category, assetId), tags entity', () => {
    getInstance.mockReturnValue(null);
    const obj = meshToObject3D(placement());
    expect(obj).toBeInstanceOf(THREE.Mesh);
    expect(preload).toHaveBeenCalledWith('light-fixture', 'pendant_lamp_01');
    expect(obj.userData['bimType']).toBe('mep-fixture');
    expect(obj.userData['bimId']).toBe('mepfix_1');
  });

  it("anchor 'top' hangs the box so its TOP sits at the mounting plane", () => {
    getInstance.mockReturnValue(null);
    const obj = meshToObject3D(placement({ verticalAnchor: 'top' }));
    // plan (1000,2000) mm → world (1, *, -2) m; mounting 2.7m, height 0.4m centred
    // box → centre at mounting − h/2 = 2.7 − 0.2 = 2.5m.
    expect(obj.position.x).toBeCloseTo(1.0, 5);
    expect(obj.position.z).toBeCloseTo(-2.0, 5);
    expect(obj.position.y).toBeCloseTo(2.5, 5);
  });

  it("anchor 'base' rests the box so its BASE sits at the mounting plane", () => {
    getInstance.mockReturnValue(null);
    const obj = meshToObject3D(placement({ verticalAnchor: 'base', mountingElevationMm: 0 }));
    // base on floor → box centre at h/2 = 0.2m.
    expect(obj.position.y).toBeCloseTo(0.2, 5);
  });

  it('is units-safe: a meter scene does NOT multiply position by 1000', () => {
    getInstance.mockReturnValue(null);
    const obj = meshToObject3D(placement({ sceneUnits: 'm', position: { x: 1, y: 2 } }));
    expect(obj.position.x).toBeCloseTo(1.0, 5);
    expect(obj.position.z).toBeCloseTo(-2.0, 5);
  });
});

describe('meshToObject3D — cache hit (real mesh)', () => {
  it('clones-in-place, applies rotation + scale, never calls preload', () => {
    const tmpl = new THREE.Group();
    getInstance.mockReturnValue(tmpl);
    const obj = meshToObject3D(placement({ rotationDeg: 90, scale: 2 }));
    expect(obj).toBe(tmpl);
    expect(preload).not.toHaveBeenCalled();
    expect(obj.scale.x).toBeCloseTo(2, 5);
    expect(obj.rotation.y).toBeCloseTo(-Math.PI / 2, 5);
  });

  it("anchor 'top' lands a real mesh's top edge on the mounting plane (bbox-based)", () => {
    // A 1m-tall box whose local centre is at y=0 → spans [-0.5, +0.5].
    const tmpl = new THREE.Group();
    tmpl.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 0.2)));
    getInstance.mockReturnValue(tmpl);
    const obj = meshToObject3D(placement({ verticalAnchor: 'top', mountingElevationMm: 3000, scale: 1 }));
    // top of the box must sit at 3.0m → centre at 3.0 − 0.5 = 2.5m.
    expect(obj.position.y).toBeCloseTo(2.5, 4);
  });

  it('empty group falls back to anchor at origin (position.y === mounting)', () => {
    getInstance.mockReturnValue(new THREE.Group());
    const obj = meshToObject3D(placement({ verticalAnchor: 'base', mountingElevationMm: 0 }));
    expect(obj.position.y).toBeCloseTo(0, 5);
  });
});
