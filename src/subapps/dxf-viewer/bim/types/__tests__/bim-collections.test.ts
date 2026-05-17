/**
 * ADR-363 Phase 0 — BIM Firestore collection constants unit tests.
 *
 * Verifies:
 *  - All 9 BIM collections are defined in COLLECTIONS (ADR-363 §5.10)
 *  - Collection names match the documented Firestore collection names
 *  - Names are non-empty strings (no undefined env var → blank)
 */

import { COLLECTIONS } from '@/config/firestore-collections';

describe('ADR-363 BIM Firestore Collections', () => {
  const EXPECTED: [keyof typeof COLLECTIONS, string][] = [
    ['FLOORPLAN_WALLS', 'floorplan_walls'],
    ['FLOORPLAN_OPENINGS', 'floorplan_openings'],
    ['FLOORPLAN_SLABS', 'floorplan_slabs'],
    ['FLOORPLAN_SLAB_OPENINGS', 'floorplan_slab_openings'],
    ['FLOORPLAN_COLUMNS', 'floorplan_columns'],
    ['FLOORPLAN_BEAMS', 'floorplan_beams'],
    ['BIM_PRESETS', 'bim_presets'],
    ['BIM_MATERIALS', 'bim_materials'],
    ['BIM_SETTINGS', 'bim_settings'],
  ];

  test.each(EXPECTED)('COLLECTIONS.%s === "%s"', (key, expectedName) => {
    expect(COLLECTIONS[key]).toBe(expectedName);
  });

  test.each(EXPECTED)('COLLECTIONS.%s is non-empty string', (key) => {
    expect(typeof COLLECTIONS[key]).toBe('string');
    expect(COLLECTIONS[key].length).toBeGreaterThan(0);
  });

  it('FLOORPLAN_STAIRS still defined (ADR-358 backward compat)', () => {
    expect(COLLECTIONS.FLOORPLAN_STAIRS).toBe('floorplan_stairs');
  });

  it('BIM collections use underscore convention (no hyphens)', () => {
    EXPECTED.forEach(([key]) => {
      expect(COLLECTIONS[key]).not.toContain('-');
    });
  });
});
