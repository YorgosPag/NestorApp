/**
 * Tests for multi-level level-data seed helpers (ADR-236 Phase 2).
 * @see src/services/multi-level.service.ts
 */

import {
  aggregateLevelData,
  buildEmptyLevelData,
  buildSeededLevelData,
} from '../multi-level.service';
import type { LevelData, PropertyLevel } from '@/types/property';

const LEVELS: PropertyLevel[] = [
  { floorId: 'flr_a', floorNumber: 0, name: 'Ισόγειο', isPrimary: true },
  { floorId: 'flr_b', floorNumber: 1, name: '1ος', isPrimary: false },
];

describe('buildEmptyLevelData', () => {
  it('returns a FULL zeroed schema, never an empty object', () => {
    const empty = buildEmptyLevelData();
    expect(empty.areas).toEqual({ gross: 0, net: 0, balcony: 0, terrace: 0, garden: 0 });
    expect(empty.layout).toEqual({ bedrooms: 0, bathrooms: 0, wc: 0 });
    expect(empty.orientations).toEqual([]);
  });

  it('returns fresh instances (no shared-reference aliasing)', () => {
    const a = buildEmptyLevelData();
    const b = buildEmptyLevelData();
    expect(a).not.toBe(b);
    expect(a.areas).not.toBe(b.areas);
  });
});

describe('buildSeededLevelData', () => {
  it('seeds a full schema for every declared level when none exists', () => {
    const seeded = buildSeededLevelData(LEVELS, undefined);
    expect(Object.keys(seeded).sort()).toEqual(['flr_a', 'flr_b']);
    expect(seeded.flr_a.areas?.gross).toBe(0);
    expect(seeded.flr_b.areas?.gross).toBe(0);
  });

  it('preserves existing values while normalizing to the full schema', () => {
    const existing: Record<string, LevelData> = {
      flr_a: { areas: { gross: 130 }, layout: { bedrooms: 3 }, orientations: ['north'] },
    };
    const seeded = buildSeededLevelData(LEVELS, existing);
    // values preserved
    expect(seeded.flr_a.areas?.gross).toBe(130);
    expect(seeded.flr_a.layout?.bedrooms).toBe(3);
    expect(seeded.flr_a.orientations).toEqual(['north']);
    // missing sub-keys filled (no partial schema across levels)
    expect(seeded.flr_a.areas).toEqual({ gross: 130, net: 0, balcony: 0, terrace: 0, garden: 0 });
    expect(seeded.flr_a.layout).toEqual({ bedrooms: 3, bathrooms: 0, wc: 0 });
    expect(seeded.flr_b.areas?.gross).toBe(0); // missing level seeded
  });

  it('fills a missing areas.garden key on a partial primary level (the cosmetic bug)', () => {
    const existing: Record<string, LevelData> = {
      // primary level entered by the user without ever touching `garden`
      flr_a: { areas: { gross: 130, net: 115, balcony: 15, terrace: 20 }, orientations: ['southwest'] },
    };
    const seeded = buildSeededLevelData(LEVELS, existing);
    expect(seeded.flr_a.areas).toEqual({
      gross: 130,
      net: 115,
      balcony: 15,
      terrace: 20,
      garden: 0, // ← was missing, now filled to match the secondary level shape
    });
  });

  it('preserves extra fields (finishes) when normalizing', () => {
    const existing: Record<string, LevelData> = {
      flr_a: { areas: { gross: 130 }, finishes: { windowFrames: 'aluminum' } },
    };
    const seeded = buildSeededLevelData(LEVELS, existing);
    expect(seeded.flr_a.finishes).toEqual({ windowFrames: 'aluminum' }); // no data loss
    expect(seeded.flr_a.areas?.garden).toBe(0); // still normalized
  });

  it('replaces an empty {} entry with the full schema (the bug)', () => {
    const existing: Record<string, LevelData> = {
      flr_a: { areas: { gross: 130 } },
      flr_b: {}, // ← empty object bug
    };
    const seeded = buildSeededLevelData(LEVELS, existing);
    expect(seeded.flr_b.areas).toEqual({ gross: 0, net: 0, balcony: 0, terrace: 0, garden: 0 });
  });

  it('drops orphan keys not present in the declared levels', () => {
    const existing: Record<string, LevelData> = {
      flr_a: { areas: { gross: 130 } },
      flr_b: { areas: { gross: 40 } },
      flr_ghost: { areas: { gross: 999 } }, // orphan
    };
    const seeded = buildSeededLevelData(LEVELS, existing);
    expect(seeded).not.toHaveProperty('flr_ghost');
  });
});

describe('aggregateLevelData (with seeded empty levels)', () => {
  it('treats seeded-empty levels as zero contributors', () => {
    const seeded = buildSeededLevelData(LEVELS, { flr_a: { areas: { gross: 130 } } });
    const agg = aggregateLevelData(seeded);
    expect(agg.areas.gross).toBe(130);
  });
});
