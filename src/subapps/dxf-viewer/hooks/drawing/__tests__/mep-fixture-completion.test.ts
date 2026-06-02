/**
 * ADR-406 — MEP fixture completion builders unit tests.
 */

import {
  buildDefaultMepFixtureParams,
  buildMepFixtureEntity,
} from '../mep-fixture-completion';

describe('buildDefaultMepFixtureParams', () => {
  it('lifts the click point into a Point3D position', () => {
    const p = buildDefaultMepFixtureParams({ x: 10, y: 20 });
    expect(p.position).toEqual({ x: 10, y: 20, z: 0 });
  });

  it('defaults to a 600×600 rectangular light fixture at ceiling height', () => {
    const p = buildDefaultMepFixtureParams({ x: 0, y: 0 });
    expect(p.kind).toBe('light-fixture');
    expect(p.shape).toBe('rectangular');
    expect(p.width).toBe(600);
    expect(p.length).toBe(600);
    expect(p.mountingElevationMm).toBe(2700);
  });

  it('circular shape defaults width to the downlight diameter', () => {
    const p = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { shape: 'circular' });
    expect(p.width).toBe(200);
  });

  it('applies overrides', () => {
    const p = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { width: 1200, mountingElevationMm: 3000 });
    expect(p.width).toBe(1200);
    expect(p.mountingElevationMm).toBe(3000);
  });
});

describe('buildMepFixtureEntity', () => {
  it('builds a valid entity with computed geometry + enterprise id + IFC mixin', () => {
    const params = buildDefaultMepFixtureParams({ x: 0, y: 0 });
    const result = buildMepFixtureEntity(params, 'lyr_test');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entity.type).toBe('mep-fixture');
    expect(result.entity.ifcType).toBe('IfcLightFixture');
    expect(result.entity.id).toBeTruthy();
    expect(result.entity.ifcGuid).toMatch(/^[0-9A-Za-z_$]{22}$/);
    expect(result.entity.geometry.footprint.vertices.length).toBeGreaterThanOrEqual(3);
    expect(result.entity.layerId).toBe('lyr_test');
  });

  it('refuses creation on a hard validation error', () => {
    const params = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { width: 0 });
    const result = buildMepFixtureEntity(params, 'lyr_test');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hardErrors.length).toBeGreaterThan(0);
  });
});
