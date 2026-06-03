/**
 * ADR-411 — mep-fixture-to-mesh unit tests (opt-in mesh vs parametric fallback).
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

import { mepFixtureToObject3D } from '../mep-fixture-to-mesh';
import type { MepFixtureEntity, MepFixtureParams } from '../../../bim/types/mep-fixture-types';

function fixture(paramOverrides: Partial<MepFixtureParams> = {}): MepFixtureEntity {
  const params: MepFixtureParams = {
    kind: 'light-fixture',
    shape: 'rectangular',
    position: { x: 1000, y: 2000, z: 0 },
    rotation: 0,
    width: 300,
    length: 300,
    bodyHeightMm: 80,
    mountingElevationMm: 2700,
    sceneUnits: 'mm',
    ...paramOverrides,
  };
  return {
    id: 'mepfix_1',
    type: 'mep-fixture',
    kind: 'light-fixture',
    params,
    geometry: { footprint: { vertices: [] }, bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, area: 0, height: 80 },
    ifcType: 'IfcLightFixture',
  } as unknown as MepFixtureEntity;
}

beforeEach(() => {
  getInstance.mockReset();
  preload.mockReset();
});

it('returns null for a parametric fixture (no assetId) → caller falls back', () => {
  expect(mepFixtureToObject3D(fixture(), 0, 'L0', 0)).toBeNull();
  expect(preload).not.toHaveBeenCalled();
});

it('builds a mesh (placeholder on miss) for a fixture carrying an assetId', () => {
  getInstance.mockReturnValue(null);
  const obj = mepFixtureToObject3D(fixture({ assetId: 'pendant_lamp_01' }), 0, 'L0', 0);
  expect(obj).toBeInstanceOf(THREE.Mesh);
  expect(preload).toHaveBeenCalledWith('light-fixture', 'pendant_lamp_01');
  expect(obj!.userData['bimType']).toBe('mep-fixture');
});
