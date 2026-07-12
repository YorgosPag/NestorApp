/**
 * ADR-643 Φ3 — hatch image-fill build SSoT tests.
 * Validates defaults→imageFill construction + immutable single-field patch, and the
 * Revit/ArchiCAD behaviour that picking a material adopts its real-world tile size.
 */

import { buildImageFillFromDefaults, withImageFillPatch } from '../hatch-image-build';
import { DEFAULT_HATCH_DRAW_DEFAULTS } from '../hatch-draw-defaults-store';
import { getMaterialImageDefaultTileMm } from '../../../data/material-image-catalog';

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
});
