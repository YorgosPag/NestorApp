/**
 * Tests — sanitary-fixture mesh catalog (ADR-411 sanitary category).
 */

import {
  SANITARY_MESH_CATALOG,
  resolveSanitaryFixtureAsset,
  sanitaryMeshPresetsForKind,
} from '../sanitary-fixture-mesh-catalog';

describe('sanitary-fixture-mesh-catalog', () => {
  it('ships at least the opening CC-BY shower preset', () => {
    expect(SANITARY_MESH_CATALOG.length).toBeGreaterThanOrEqual(1);
    const shower = SANITARY_MESH_CATALOG.find((p) => p.id === 'shower_realistic_01');
    expect(shower).toBeDefined();
    expect(shower?.kind).toBe('shower');
    // Real walk-in cabin dims (glTF world bbox, already real-world meters).
    expect(shower?.widthMm).toBeGreaterThan(0);
    expect(shower?.heightMm).toBeGreaterThan(1500);
    // Floor-standing.
    expect(shower?.mountingElevationMm).toBe(0);
  });

  it('carries a CC-BY attribution in source (legal obligation)', () => {
    const shower = resolveSanitaryFixtureAsset('shower_realistic_01');
    expect(shower?.source).toMatch(/\(CC-BY\)/);
    expect(shower?.source.toLowerCase()).toContain('sketchfab');
  });

  it('resolves a known asset and rejects an unknown one', () => {
    expect(resolveSanitaryFixtureAsset('shower_realistic_01')).toBeDefined();
    expect(resolveSanitaryFixtureAsset('does_not_exist')).toBeUndefined();
  });

  it('filters presets by sanitary kind', () => {
    const showerPresets = sanitaryMeshPresetsForKind('shower');
    expect(showerPresets.some((p) => p.id === 'shower_realistic_01')).toBe(true);
    // Per-kind isolation: shower presets never leak a WC mesh, and vice-versa.
    expect(showerPresets.some((p) => p.kind !== 'shower')).toBe(false);
    const wcPresets = sanitaryMeshPresetsForKind('wc');
    expect(wcPresets.some((p) => p.id === 'wc_realistic_01')).toBe(true);
    expect(wcPresets.some((p) => p.kind !== 'wc')).toBe(false);
    // A kind without any authored mesh → empty (picker offers only Parametric).
    expect(sanitaryMeshPresetsForKind('bidet')).toHaveLength(0);
  });

  it('ships the WC pan preset (CC-BY, floor-standing, measured dims)', () => {
    const wc = resolveSanitaryFixtureAsset('wc_realistic_01');
    expect(wc?.kind).toBe('wc');
    expect(wc?.widthMm).toBeGreaterThan(0);
    expect(wc?.depthMm).toBeGreaterThan(0);
    expect(wc?.heightMm).toBeGreaterThan(0);
    expect(wc?.mountingElevationMm).toBe(0);
    expect(wc?.source).toMatch(/\(CC-BY\)/);
  });
});
