/**
 * ADR-643 Φ3 — hatch image-fill build SSoT tests.
 * Validates defaults→imageFill construction + immutable single-field patch, and the
 * Revit/ArchiCAD behaviour that picking a material adopts its real-world tile size.
 */

import { buildImageFillFromDefaults, withImageFillPatch } from '../hatch-image-build';
import { DEFAULT_HATCH_DRAW_DEFAULTS } from '../hatch-draw-defaults-store';
import { getMaterialImageDefaultTileMm } from '../../../data/material-image-catalog';
import { proceduralAssetId, proceduralDefaultTileMm } from '../../../data/procedural-material-catalog';

const D = DEFAULT_HATCH_DRAW_DEFAULTS;

describe('hatch-image-build (ADR-643 Φ3)', () => {
  describe('buildImageFillFromDefaults()', () => {
    it('maps the flat draw-defaults into an imageFill object', () => {
      expect(buildImageFillFromDefaults(D)).toEqual({
        assetId: D.imageAssetId,
        tileWidth: D.imageTileWidth,
        tileHeight: D.imageTileHeight,
        angle: D.imageAngle,
      });
    });
  });

  describe('withImageFillPatch()', () => {
    it('builds from defaults when current is undefined', () => {
      const next = withImageFillPatch(undefined, D, { field: 'angle', value: 30 });
      expect(next.assetId).toBe(D.imageAssetId);
      expect(next.angle).toBe(30);
    });

    it('changing material adopts that material real-world tile size (Revit/ArchiCAD)', () => {
      const current = { assetId: 'matimg-ceramic-tile', tileWidth: 123, tileHeight: 123, angle: 15 };
      const next = withImageFillPatch(current, D, { field: 'assetId', value: 'matimg-concrete' });
      const tile = getMaterialImageDefaultTileMm('matimg-concrete');
      expect(next.assetId).toBe('matimg-concrete');
      expect(next.tileWidth).toBe(tile.width);
      expect(next.tileHeight).toBe(tile.height);
      // angle is preserved across a material change
      expect(next.angle).toBe(15);
    });

    it('patches a single dimension immutably without touching others', () => {
      const current = { assetId: 'matimg-wood', tileWidth: 1500, tileHeight: 1500, angle: 0 };
      const next = withImageFillPatch(current, D, { field: 'tileWidth', value: 900 });
      expect(next).toEqual({ assetId: 'matimg-wood', tileWidth: 900, tileHeight: 1500, angle: 0 });
      expect(current.tileWidth).toBe(1500); // original untouched
    });
  });

  describe('grout (ADR-643 Φ5)', () => {
    const base = { assetId: 'matimg-wood', tileWidth: 600, tileHeight: 600, angle: 0 };

    it('omits grout from defaults when disabled', () => {
      expect(buildImageFillFromDefaults(D).grout).toBeUndefined();
    });

    it('includes grout from defaults when enabled', () => {
      const enabled = { ...D, groutEnabled: true, groutColor: '#eee', groutWidthMm: 8 };
      expect(buildImageFillFromDefaults(enabled).grout).toEqual({ color: '#eee', widthMm: 8 });
    });

    it('enabling grout creates it from the default color/width', () => {
      const next = withImageFillPatch(base, D, { field: 'groutEnabled', value: true });
      expect(next.grout).toEqual({ color: D.groutColor, widthMm: D.groutWidthMm });
    });

    it('disabling grout removes the object', () => {
      const withGrout = { ...base, grout: { color: '#fff', widthMm: 5 } };
      const next = withImageFillPatch(withGrout, D, { field: 'groutEnabled', value: false });
      expect(next.grout).toBeUndefined();
    });

    it('setting grout colour enables it and keeps the default width', () => {
      const next = withImageFillPatch(base, D, { field: 'groutColor', value: '#333333' });
      expect(next.grout).toEqual({ color: '#333333', widthMm: D.groutWidthMm });
    });

    it('setting grout width preserves the existing colour', () => {
      const withGrout = { ...base, grout: { color: '#abcdef', widthMm: 5 } };
      const next = withImageFillPatch(withGrout, D, { field: 'groutWidth', value: 12 });
      expect(next.grout).toEqual({ color: '#abcdef', widthMm: 12 });
    });
  });

  describe('tint / duotone (ADR-653 Φ8)', () => {
    const base = { assetId: 'matimg-ceramic-tile', tileWidth: 600, tileHeight: 600, angle: 0 };

    it('omits tint from defaults when disabled', () => {
      expect(buildImageFillFromDefaults(D).tint).toBeUndefined();
    });

    it('includes tint from defaults when enabled', () => {
      const enabled = { ...D, tintEnabled: true, tintColorA: '#111', tintColorB: '#eee', tintStrength: 0.5 };
      expect(buildImageFillFromDefaults(enabled).tint).toEqual({ colorA: '#111', colorB: '#eee', strength: 0.5 });
    });

    it('enabling tint creates it from the default colours/strength', () => {
      const next = withImageFillPatch(base, D, { field: 'tintEnabled', value: true });
      expect(next.tint).toEqual({ colorA: D.tintColorA, colorB: D.tintColorB, strength: D.tintStrength });
    });

    it('disabling tint removes the object', () => {
      const withTint = { ...base, tint: { colorA: '#000', colorB: '#fff', strength: 1 } };
      const next = withImageFillPatch(withTint, D, { field: 'tintEnabled', value: false });
      expect(next.tint).toBeUndefined();
    });

    it('setting colour A enables tint and keeps the default B/strength', () => {
      const next = withImageFillPatch(base, D, { field: 'tintColorA', value: '#123456' });
      expect(next.tint).toEqual({ colorA: '#123456', colorB: D.tintColorB, strength: D.tintStrength });
    });

    it('setting strength preserves the existing colours', () => {
      const withTint = { ...base, tint: { colorA: '#000000', colorB: '#ffffff', strength: 1 } };
      const next = withImageFillPatch(withTint, D, { field: 'tintStrength', value: 0.25 });
      expect(next.tint).toEqual({ colorA: '#000000', colorB: '#ffffff', strength: 0.25 });
    });

    it('tint and grout coexist independently', () => {
      const withBoth = withImageFillPatch(
        withImageFillPatch(base, D, { field: 'groutEnabled', value: true }),
        D, { field: 'tintEnabled', value: true },
      );
      expect(withBoth.grout).toBeDefined();
      expect(withBoth.tint).toBeDefined();
    });
  });

  describe('procedural (ADR-653 Φ9)', () => {
    const rasterBase = { assetId: 'matimg-ceramic-tile', tileWidth: 600, tileHeight: 600, angle: 0 };
    const checkerId = proceduralAssetId('checker');

    it('selecting a procedural material sets params + adopts its tile size + clears tint', () => {
      const withTint = { ...rasterBase, tint: { colorA: '#000', colorB: '#fff', strength: 1 } };
      const next = withImageFillPatch(withTint, D, { field: 'assetId', value: checkerId });
      expect(next.assetId).toBe(checkerId);
      expect(next.procedural?.generator).toBe('checker');
      expect(next.procedural?.colors.length).toBeGreaterThanOrEqual(2);
      expect(next.tint).toBeUndefined(); // procedural ορίζει χρώματα → tint άσχετο
      const tile = proceduralDefaultTileMm('checker');
      expect(next.tileWidth).toBe(tile.width);
      expect(next.tileHeight).toBe(tile.height);
    });

    it('switching from procedural back to a raster material clears the procedural params', () => {
      const proc = withImageFillPatch(rasterBase, D, { field: 'assetId', value: checkerId });
      const back = withImageFillPatch(proc, D, { field: 'assetId', value: 'matimg-wood' });
      expect(back.procedural).toBeUndefined();
      expect(back.assetId).toBe('matimg-wood');
    });

    it('patches procedural colour 1 / colour 2 immutably', () => {
      const proc = withImageFillPatch(rasterBase, D, { field: 'assetId', value: checkerId });
      const a = withImageFillPatch(proc, D, { field: 'procColorA', value: '#112233' });
      expect(a.procedural?.colors[0]).toBe('#112233');
      const b = withImageFillPatch(a, D, { field: 'procColorB', value: '#445566' });
      expect(b.procedural?.colors[1]).toBe('#445566');
      expect(b.procedural?.colors[0]).toBe('#112233'); // colour 1 preserved
    });

    it('patches procedural joint width/colour', () => {
      const proc = withImageFillPatch(rasterBase, D, { field: 'assetId', value: proceduralAssetId('grid-tile') });
      const j = withImageFillPatch(proc, D, { field: 'procJointMm', value: 15 });
      expect(j.procedural?.jointMm).toBe(15);
      const jc = withImageFillPatch(j, D, { field: 'procJointColor', value: '#777777' });
      expect(jc.procedural?.jointColor).toBe('#777777');
    });

    it('buildImageFillFromDefaults includes procedural when the default asset is proc:*', () => {
      const procDefaults = { ...D, imageAssetId: checkerId, procColorA: '#101010', procColorB: '#efefef' };
      const fill = buildImageFillFromDefaults(procDefaults);
      expect(fill.procedural?.generator).toBe('checker');
      expect(fill.procedural?.colors).toEqual(['#101010', '#efefef']);
      expect(fill.tint).toBeUndefined();
    });
  });
});
