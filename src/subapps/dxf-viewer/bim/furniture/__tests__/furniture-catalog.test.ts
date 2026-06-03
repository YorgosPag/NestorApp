/**
 * ADR-410 — Furniture catalog SSoT unit tests.
 */

import {
  FURNITURE_CATALOG,
  DEFAULT_FURNITURE_ASSET_ID,
  resolveFurnitureAsset,
} from '../furniture-catalog';

describe('furniture catalog', () => {
  it('ships at least one CC0 asset (the chair vertical slice)', () => {
    expect(FURNITURE_CATALOG.length).toBeGreaterThanOrEqual(1);
  });

  it('the default asset id resolves to a catalog preset', () => {
    const preset = resolveFurnitureAsset(DEFAULT_FURNITURE_ASSET_ID);
    expect(preset).toBeDefined();
    expect(preset?.kind).toBe('chair');
  });

  it('every preset carries authored footprint dimensions', () => {
    for (const p of FURNITURE_CATALOG) {
      expect(p.widthMm).toBeGreaterThan(0);
      expect(p.depthMm).toBeGreaterThan(0);
      expect(p.heightMm).toBeGreaterThan(0);
      expect(p.labelKey).toMatch(/^furniture\.catalog\./);
    }
  });

  it('returns undefined for an unknown asset id', () => {
    expect(resolveFurnitureAsset('does_not_exist')).toBeUndefined();
  });
});
