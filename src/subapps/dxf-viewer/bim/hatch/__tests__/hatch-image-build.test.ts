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
});
