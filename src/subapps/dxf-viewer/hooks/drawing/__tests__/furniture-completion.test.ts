/**
 * ADR-410 — Furniture completion builders unit tests.
 */

import {
  buildDefaultFurnitureParams,
  buildFurnitureEntity,
} from '../furniture-completion';

describe('buildDefaultFurnitureParams', () => {
  it('places at the clicked point with catalog footprint defaults', () => {
    const p = buildDefaultFurnitureParams({ x: 1500, y: 2500 });
    expect(p.position).toEqual({ x: 1500, y: 2500, z: 0 });
    expect(p.assetId).toBe('dining_chair_02');
    expect(p.kind).toBe('chair');
    expect(p.widthMm).toBeGreaterThan(0);
    expect(p.depthMm).toBeGreaterThan(0);
    expect(p.heightMm).toBeGreaterThan(0);
    expect(p.mountingElevationMm).toBe(0);
  });

  it('applies overrides over the catalog defaults', () => {
    const p = buildDefaultFurnitureParams({ x: 0, y: 0 }, { rotationDeg: 90, scaleOverride: 1.5, widthMm: 700 });
    expect(p.rotationDeg).toBe(90);
    expect(p.scaleOverride).toBe(1.5);
    expect(p.widthMm).toBe(700);
  });

  it('carries the scene units through', () => {
    const p = buildDefaultFurnitureParams({ x: 0, y: 0 }, {}, 'm');
    expect(p.sceneUnits).toBe('m');
  });
});

describe('buildFurnitureEntity', () => {
  it('builds a valid furniture entity with geometry + IFC mixin', () => {
    const params = buildDefaultFurnitureParams({ x: 100, y: 200 });
    const result = buildFurnitureEntity(params, 'layer-0');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entity.type).toBe('furniture');
      expect(result.entity.ifcType).toBe('IfcFurniture');
      expect(result.entity.id).toMatch(/^furn_/);
      expect(result.entity.geometry.footprint.vertices).toHaveLength(4);
    }
  });

  it('refuses creation when params are invalid (missing asset)', () => {
    const params = buildDefaultFurnitureParams({ x: 0, y: 0 });
    const result = buildFurnitureEntity({ ...params, assetId: '' }, 'layer-0');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hardErrors).toContain('furniture.validation.hardErrors.missingAsset');
    }
  });
});
