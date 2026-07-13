/**
 * ADR-653 Φ9 — procedural material catalog SSoT tests.
 */

import {
  PROCEDURAL_ASSET_PREFIX,
  isProceduralAssetId,
  proceduralAssetId,
  listProceduralMaterials,
  getProceduralMaterial,
  getProceduralMaterialByAssetId,
  defaultProceduralParams,
  proceduralDefaultTileMm,
  proceduralMaterialLabelKey,
} from '../procedural-material-catalog';

describe('procedural-material-catalog (ADR-653 Φ9)', () => {
  it('assetId round-trips through the proc: prefix', () => {
    expect(proceduralAssetId('checker')).toBe(`${PROCEDURAL_ASSET_PREFIX}checker`);
    expect(isProceduralAssetId('proc:checker')).toBe(true);
    expect(isProceduralAssetId('matimg-ceramic-tile')).toBe(false);
    expect(isProceduralAssetId(undefined)).toBe(false);
  });

  it('resolves a generator from a proc: assetId', () => {
    expect(getProceduralMaterialByAssetId('proc:running-bond')?.generator).toBe('running-bond');
    expect(getProceduralMaterialByAssetId('matimg-wood')).toBeUndefined();
  });

  it('lists distinct generators, each with a label key + tile size', () => {
    const all = listProceduralMaterials();
    expect(all.length).toBeGreaterThanOrEqual(4);
    const ids = new Set(all.map((d) => d.generator));
    expect(ids.size).toBe(all.length); // no duplicate generators
    for (const def of all) {
      expect(proceduralMaterialLabelKey(def)).toBe(`proceduralMaterials.${def.labelKeySuffix}`);
      const tile = proceduralDefaultTileMm(def.generator);
      expect(tile.width).toBeGreaterThan(0);
      expect(tile.height).toBeGreaterThan(0);
    }
  });

  it('default params carry the generator + at least one colour', () => {
    const p = defaultProceduralParams('checker');
    expect(p.generator).toBe('checker');
    expect(p.colors.length).toBeGreaterThanOrEqual(1);
  });

  it('a jointed generator (grid-tile) ships a joint by default; checker does not', () => {
    expect(defaultProceduralParams('grid-tile').jointMm).toBeGreaterThan(0);
    expect(defaultProceduralParams('checker').jointMm).toBeUndefined();
  });

  it('unknown generator id falls back to a safe tile size', () => {
    expect(getProceduralMaterial('nope' as never)).toBeUndefined();
    const tile = proceduralDefaultTileMm('nope' as never);
    expect(tile.width).toBeGreaterThan(0);
  });

  it('ships the market-standard generators (checker/brick/hex/herringbone/basketweave…)', () => {
    const ids = new Set(listProceduralMaterials().map((d) => d.generator));
    for (const id of [
      'checker', 'grid-tile', 'running-bond', 'stripes',
      'herringbone', 'basketweave', 'hexagon',
    ] as const) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('parquet generators (herringbone/basketweave) carry two tones + a joint', () => {
    for (const id of ['herringbone', 'basketweave'] as const) {
      const p = defaultProceduralParams(id);
      expect(p.colors.length).toBe(2);
      expect(p.jointMm).toBeGreaterThan(0);
      expect(p.jointColor).toBeTruthy();
    }
  });

  it('hexagon is a grouted single-colour tile with a non-square √3:3 repeat unit', () => {
    const p = defaultProceduralParams('hexagon');
    expect(p.colors.length).toBe(1);
    expect(p.jointMm).toBeGreaterThan(0);
    const tile = proceduralDefaultTileMm('hexagon');
    // √3R × 3R → height/width ≈ √3 ≈ 1.732 (κανονικά εξάγωνα).
    expect(tile.height / tile.width).toBeCloseTo(Math.sqrt(3), 1);
  });
});
