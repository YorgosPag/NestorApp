/**
 * ADR-419 — Floor-finish material catalog unit tests.
 * Validates catalog completeness, thermal properties, and accessor correctness.
 */

import {
  listFloorFinishMaterials,
  getFloorFinishMaterial,
  getFloorFinishLambda,
  getFloorFinishHatchType,
  getFloorFinishColor,
  getFloorFinishPbrSlug,
} from '../floor-finish-material-catalog';
import type { FloorFinishMaterialId } from '../../types/floor-finish-types';

const EXPECTED_IDS: FloorFinishMaterialId[] = [
  'floor-wood-oak',
  'floor-wood-pine',
  'floor-tile-ceramic',
  'floor-tile-marble',
  'floor-laminate',
  'floor-parquet',
  'floor-epoxy',
  'floor-carpet',
];

describe('Floor-finish material catalog', () => {
  describe('listFloorFinishMaterials()', () => {
    it('returns exactly 8 materials', () => {
      expect(listFloorFinishMaterials()).toHaveLength(8);
    });

    it('contains all expected material IDs', () => {
      const ids = listFloorFinishMaterials().map((m) => m.id);
      for (const expected of EXPECTED_IDS) {
        expect(ids).toContain(expected);
      }
    });

    it('every entry has a positive lambda, density, specificHeat', () => {
      for (const m of listFloorFinishMaterials()) {
        expect(m.lambda).toBeGreaterThan(0);
        expect(m.density).toBeGreaterThan(0);
        expect(m.specificHeat).toBeGreaterThan(0);
      }
    });

    it('every color is a valid CSS hex', () => {
      for (const m of listFloorFinishMaterials()) {
        expect(m.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('every labelKeySuffix is non-empty', () => {
      for (const m of listFloorFinishMaterials()) {
        expect(m.labelKeySuffix.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getFloorFinishLambda()', () => {
    it('returns number for all known IDs', () => {
      for (const id of EXPECTED_IDS) {
        const lambda = getFloorFinishLambda(id);
        expect(typeof lambda).toBe('number');
        expect(lambda).toBeGreaterThan(0);
      }
    });

    it('returns undefined for unknown ID', () => {
      expect(getFloorFinishLambda('unknown-material')).toBeUndefined();
    });

    it('returns undefined for undefined input', () => {
      expect(getFloorFinishLambda(undefined)).toBeUndefined();
    });

    it('ceramic tile has higher lambda than carpet (thermal conductivity order)', () => {
      const ceramic = getFloorFinishLambda('floor-tile-ceramic')!;
      const carpet = getFloorFinishLambda('floor-carpet')!;
      expect(ceramic).toBeGreaterThan(carpet);
    });
  });

  describe('R-value computation (lambda / thickness)', () => {
    it('20mm ceramic tile: R ≈ 0.02 m²·K/W', () => {
      const lambda = getFloorFinishLambda('floor-tile-ceramic')!;
      const thicknessM = 0.020;
      const R = thicknessM / lambda;
      expect(R).toBeCloseTo(0.02, 2);
    });

    it('20mm oak wood: R > ceramic (lower lambda)', () => {
      const lambdaWood = getFloorFinishLambda('floor-wood-oak')!;
      const lambdaCeramic = getFloorFinishLambda('floor-tile-ceramic')!;
      const thicknessM = 0.020;
      expect(thicknessM / lambdaWood).toBeGreaterThan(thicknessM / lambdaCeramic);
    });
  });

  describe('getFloorFinishHatchType()', () => {
    it('wood materials return "wood" hatch', () => {
      expect(getFloorFinishHatchType('floor-wood-oak')).toBe('wood');
      expect(getFloorFinishHatchType('floor-wood-pine')).toBe('wood');
      expect(getFloorFinishHatchType('floor-laminate')).toBe('wood');
      expect(getFloorFinishHatchType('floor-parquet')).toBe('wood');
    });

    it('tile materials return "tile" hatch', () => {
      expect(getFloorFinishHatchType('floor-tile-ceramic')).toBe('tile');
      expect(getFloorFinishHatchType('floor-tile-marble')).toBe('tile');
    });

    it('epoxy returns "solid" hatch', () => {
      expect(getFloorFinishHatchType('floor-epoxy')).toBe('solid');
    });

    it('carpet returns "dot" hatch', () => {
      expect(getFloorFinishHatchType('floor-carpet')).toBe('dot');
    });

    it('unknown ID falls back to "solid"', () => {
      expect(getFloorFinishHatchType('unknown')).toBe('solid');
    });
  });

  describe('getFloorFinishColor()', () => {
    it('returns hex color for known IDs', () => {
      for (const id of EXPECTED_IDS) {
        expect(getFloorFinishColor(id)).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('falls back to #CCCCCC for unknown ID', () => {
      expect(getFloorFinishColor('unknown')).toBe('#CCCCCC');
    });
  });

  describe('getFloorFinishPbrSlug()', () => {
    it('wood materials have "wood" PBR slug', () => {
      expect(getFloorFinishPbrSlug('floor-wood-oak')).toBe('wood');
      expect(getFloorFinishPbrSlug('floor-parquet')).toBe('wood');
    });

    it('ceramic tile has "tile" PBR slug', () => {
      expect(getFloorFinishPbrSlug('floor-tile-ceramic')).toBe('tile');
    });

    it('marble tile has "stone" PBR slug', () => {
      expect(getFloorFinishPbrSlug('floor-tile-marble')).toBe('stone');
    });

    it('epoxy has no PBR slug (undefined)', () => {
      expect(getFloorFinishPbrSlug('floor-epoxy')).toBeUndefined();
    });

    it('carpet has no PBR slug (undefined)', () => {
      expect(getFloorFinishPbrSlug('floor-carpet')).toBeUndefined();
    });
  });

  describe('getFloorFinishMaterial()', () => {
    it('returns full def for known ID', () => {
      const def = getFloorFinishMaterial('floor-wood-oak');
      expect(def).toBeDefined();
      expect(def!.id).toBe('floor-wood-oak');
    });

    it('returns undefined for unknown ID', () => {
      expect(getFloorFinishMaterial('not-a-material')).toBeUndefined();
    });
  });
});
