/**
 * Unit tests — level-reconciliation helper (ADR-236 Phase 5 / Batch 22)
 */
import { reconcileLevelsForType, type FlatLevelFields } from '../level-reconciliation';
import type { PropertyLevel, LevelData } from '@/types/property';

const FLAT_EMPTY: FlatLevelFields = {
  areaGross: 0,
  areaNet: 0,
  areaBalcony: 0,
  areaTerrace: 0,
  areaGarden: 0,
  bedrooms: 0,
  bathrooms: 0,
  wc: 0,
  orientations: [],
};

const FLAT_FILLED: FlatLevelFields = {
  areaGross: 50,
  areaNet: 45,
  areaBalcony: 5,
  areaTerrace: 0,
  areaGarden: 0,
  bedrooms: 1,
  bathrooms: 1,
  wc: 0,
  orientations: ['N'],
};

const TWO_LEVELS: PropertyLevel[] = [
  { floorId: 'f1', floorNumber: 0, name: 'Ισόγειο', isPrimary: true },
  { floorId: 'f2', floorNumber: 1, name: '1ος', isPrimary: false },
];

const TWO_LEVELS_DATA: Record<string, LevelData> = {
  f1: {
    areas: { gross: 80, net: 70, balcony: 10, terrace: 0, garden: 0 },
    layout: { bedrooms: 2, bathrooms: 1, wc: 0 },
    orientations: ['N', 'E'],
  },
  f2: {
    areas: { gross: 60, net: 55, balcony: 5, terrace: 0, garden: 0 },
    layout: { bedrooms: 1, bathrooms: 1, wc: 1 },
    orientations: ['S'],
  },
};

describe('reconcileLevelsForType', () => {
  describe('multi → single transition', () => {
    it('aggregates per-level totals into flat fields and clears levels', () => {
      const result = reconcileLevelsForType({
        oldType: 'maisonette',
        newType: 'apartment',
        currentLevels: TWO_LEVELS,
        currentLevelData: TWO_LEVELS_DATA,
        flatFields: FLAT_EMPTY,
      });

      expect(result.transition).toBe('multi-to-single');
      expect(result.newLevels).toEqual([]);
      expect(result.newLevelData).toEqual({});
      expect(result.clearActiveLevel).toBe(true);
      expect(result.shouldAutoCreate).toBe(false);

      // Aggregated areas
      expect(result.flatPatch.areaGross).toBe(140);
      expect(result.flatPatch.areaNet).toBe(125);
      expect(result.flatPatch.areaBalcony).toBe(15);

      // Aggregated layout
      expect(result.flatPatch.bedrooms).toBe(3);
      expect(result.flatPatch.bathrooms).toBe(2);
      expect(result.flatPatch.wc).toBe(1);

      // Orientations union (sorted not guaranteed)
      expect(result.flatPatch.orientations).toEqual(expect.arrayContaining(['N', 'E', 'S']));
      expect(result.flatPatch.orientations).toHaveLength(3);
    });

    it('preserves manually-entered flat values when aggregation yields zero', () => {
      const result = reconcileLevelsForType({
        oldType: 'maisonette',
        newType: 'apartment',
        currentLevels: TWO_LEVELS,
        currentLevelData: { f1: {}, f2: {} },
        flatFields: FLAT_FILLED,
      });

      expect(result.transition).toBe('multi-to-single');
      expect(result.flatPatch.areaGross).toBe(50);
      expect(result.flatPatch.bedrooms).toBe(1);
    });

    it('emits autoSavePayload for edit-mode persistence', () => {
      const result = reconcileLevelsForType({
        oldType: 'maisonette',
        newType: 'apartment',
        currentLevels: TWO_LEVELS,
        currentLevelData: TWO_LEVELS_DATA,
        flatFields: FLAT_EMPTY,
      });

      expect(result.autoSavePayload).toMatchObject({
        isMultiLevel: false,
        levels: [],
        levelData: {},
        areas: { gross: 140, net: 125 },
        layout: { bedrooms: 3, bathrooms: 2, wc: 1 },
      });
    });

    it('triggers cleanup even when only levelData has entries (no levels array)', () => {
      const result = reconcileLevelsForType({
        oldType: 'maisonette',
        newType: 'apartment',
        currentLevels: [],
        currentLevelData: TWO_LEVELS_DATA,
        flatFields: FLAT_EMPTY,
      });
      expect(result.transition).toBe('multi-to-single');
      expect(result.flatPatch.areaGross).toBe(140);
    });
  });

  describe('single → multi transition', () => {
    it('signals shouldAutoCreate without mutating state', () => {
      const result = reconcileLevelsForType({
        oldType: 'apartment',
        newType: 'maisonette',
        currentLevels: [],
        currentLevelData: {},
        flatFields: FLAT_FILLED,
      });

      expect(result.transition).toBe('single-to-multi');
      expect(result.shouldAutoCreate).toBe(true);
      expect(result.clearActiveLevel).toBe(false);
      expect(result.newLevels).toEqual([]);
      expect(result.newLevelData).toEqual({});
      expect(result.flatPatch).toEqual({});
      expect(result.autoSavePayload).toBeNull();
    });
  });

  describe('no-op transitions', () => {
    it('returns none when type stays single-level', () => {
      const result = reconcileLevelsForType({
        oldType: 'apartment',
        newType: 'studio',
        currentLevels: [],
        currentLevelData: {},
        flatFields: FLAT_FILLED,
      });
      expect(result.transition).toBe('none');
      expect(result.shouldAutoCreate).toBe(false);
      expect(result.flatPatch).toEqual({});
    });

    it('returns none when multi → single but no level state exists', () => {
      const result = reconcileLevelsForType({
        oldType: 'maisonette',
        newType: 'apartment',
        currentLevels: [],
        currentLevelData: {},
        flatFields: FLAT_FILLED,
      });
      expect(result.transition).toBe('none');
      expect(result.flatPatch).toEqual({});
      expect(result.autoSavePayload).toBeNull();
    });

    it('returns none on multi → multi (e.g. maisonette → penthouse)', () => {
      const result = reconcileLevelsForType({
        oldType: 'maisonette',
        newType: 'penthouse',
        currentLevels: TWO_LEVELS,
        currentLevelData: TWO_LEVELS_DATA,
        flatFields: FLAT_EMPTY,
      });
      expect(result.transition).toBe('none');
      expect(result.newLevels).toBe(TWO_LEVELS);
      expect(result.newLevelData).toBe(TWO_LEVELS_DATA);
    });

    it('signals shouldAutoCreate true when multi type has < 2 levels yet', () => {
      const result = reconcileLevelsForType({
        oldType: 'maisonette',
        newType: 'penthouse',
        currentLevels: [],
        currentLevelData: {},
        flatFields: FLAT_EMPTY,
      });
      expect(result.transition).toBe('none');
      expect(result.shouldAutoCreate).toBe(true);
    });
  });
});
