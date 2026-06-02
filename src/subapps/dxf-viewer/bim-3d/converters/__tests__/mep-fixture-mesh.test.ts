/**
 * ADR-406 — fixtureToMesh: 3D solid placement of a point-based MEP fixture.
 *
 * Pins that the fixture's TOP face sits at the mounting elevation (ceiling-
 * relative) and the body hangs DOWN by `bodyHeightMm`, mirroring beamToMesh.
 */

import * as THREE from 'three';
import { fixtureToMesh } from '../BimToThreeConverter';
import { buildDefaultMepFixtureParams, buildMepFixtureEntity } from '../../../hooks/drawing/mep-fixture-completion';
import type { MepFixtureEntity } from '../../../bim/types/mep-fixture-types';

const MM_TO_M = 1 / 1000;

function fixture(overrides = {}): MepFixtureEntity {
  const params = buildDefaultMepFixtureParams({ x: 0, y: 0 }, overrides, 'mm');
  const res = buildMepFixtureEntity(params, '0');
  if (!res.ok) throw new Error('fixture fixture invalid');
  return res.entity;
}

describe('fixtureToMesh', () => {
  it('builds a mesh tagged as mep-fixture', () => {
    const mesh = fixtureToMesh(fixture(), 0, '0', 0);
    expect(mesh).not.toBeNull();
    expect((mesh as THREE.Mesh).userData['bimType']).toBe('mep-fixture');
  });

  it('top face sits at mounting elevation; body hangs down by bodyHeight', () => {
    // defaults: mountingElevationMm=2700, bodyHeightMm=80, floorElevationMm=0.
    const mesh = fixtureToMesh(fixture(), 0, '0', 0) as THREE.Mesh;
    // base Y = (2700 - 80) mm → 2.62 m.
    expect(mesh.position.y).toBeCloseTo((2700 - 80) * MM_TO_M, 6);
  });

  it('adds floor elevation to the placement', () => {
    const mesh = fixtureToMesh(fixture(), 3000, '0', 0) as THREE.Mesh;
    expect(mesh.position.y).toBeCloseTo((3000 + 2700 - 80) * MM_TO_M, 6);
  });

  it('returns null for a degenerate footprint', () => {
    const bad = { ...fixture(), geometry: { ...fixture().geometry, footprint: { vertices: [] } } } as MepFixtureEntity;
    expect(fixtureToMesh(bad, 0, '0', 0)).toBeNull();
  });
});
