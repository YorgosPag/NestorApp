/**
 * ADR-370 §2A — ExtendedSnapType BIM corner additions tests.
 *
 * Verifies:
 *   - All 5 new BIM_*_CORNER enum values exist with correct string literals.
 *   - All 5 appear in DEFAULT_PRO_SNAP_SETTINGS.enabledTypes.
 *   - All 5 appear in DEFAULT_PRO_SNAP_SETTINGS.priority BEFORE BIM_COLUMN_CENTER.
 *   - All 5 have perModePxTolerance = 10.
 *   - BIM_COLUMN_CENTER also present (regression guard — pre-existing value).
 */

import { ExtendedSnapType, DEFAULT_PRO_SNAP_SETTINGS } from '../../extended-types';

const BIM_CORNER_TYPES = [
  ExtendedSnapType.BIM_WALL_CORNER,
  ExtendedSnapType.BIM_BEAM_CORNER,
  ExtendedSnapType.BIM_SLAB_CORNER,
  ExtendedSnapType.BIM_COLUMN_CORNER,
  ExtendedSnapType.BIM_OPENING_CORNER,
] as const;

describe('ExtendedSnapType — BIM_*_CORNER enum values', () => {
  it('BIM_WALL_CORNER = "bim_wall_corner"', () => {
    expect(ExtendedSnapType.BIM_WALL_CORNER).toBe('bim_wall_corner');
  });

  it('BIM_BEAM_CORNER = "bim_beam_corner"', () => {
    expect(ExtendedSnapType.BIM_BEAM_CORNER).toBe('bim_beam_corner');
  });

  it('BIM_SLAB_CORNER = "bim_slab_corner"', () => {
    expect(ExtendedSnapType.BIM_SLAB_CORNER).toBe('bim_slab_corner');
  });

  it('BIM_COLUMN_CORNER = "bim_column_corner"', () => {
    expect(ExtendedSnapType.BIM_COLUMN_CORNER).toBe('bim_column_corner');
  });

  it('BIM_OPENING_CORNER = "bim_opening_corner"', () => {
    expect(ExtendedSnapType.BIM_OPENING_CORNER).toBe('bim_opening_corner');
  });

  it('BIM_COLUMN_CENTER still present (regression guard)', () => {
    expect(ExtendedSnapType.BIM_COLUMN_CENTER).toBe('bim_column_center');
  });
});

describe('DEFAULT_PRO_SNAP_SETTINGS.enabledTypes — BIM corners included', () => {
  it.each(BIM_CORNER_TYPES)('%s is in enabledTypes', (type) => {
    expect(DEFAULT_PRO_SNAP_SETTINGS.enabledTypes.has(type)).toBe(true);
  });

  it('BIM_COLUMN_CENTER still in enabledTypes (regression guard)', () => {
    expect(DEFAULT_PRO_SNAP_SETTINGS.enabledTypes.has(ExtendedSnapType.BIM_COLUMN_CENTER)).toBe(true);
  });
});

describe('DEFAULT_PRO_SNAP_SETTINGS.priority — BIM corners before BIM_COLUMN_CENTER', () => {
  const priority = DEFAULT_PRO_SNAP_SETTINGS.priority;

  it.each(BIM_CORNER_TYPES)('%s appears in priority list', (type) => {
    expect(priority).toContain(type);
  });

  it('all 5 BIM_*_CORNER appear before BIM_COLUMN_CENTER', () => {
    const centerIdx = priority.indexOf(ExtendedSnapType.BIM_COLUMN_CENTER);
    expect(centerIdx).toBeGreaterThan(-1);
    for (const type of BIM_CORNER_TYPES) {
      const idx = priority.indexOf(type);
      expect(idx).toBeGreaterThan(-1);
      expect(idx).toBeLessThan(centerIdx);
    }
  });
});

describe('DEFAULT_PRO_SNAP_SETTINGS.perModePxTolerance — BIM corners = 10', () => {
  const tol = DEFAULT_PRO_SNAP_SETTINGS.perModePxTolerance!;

  it.each(BIM_CORNER_TYPES)('%s tolerance = 10', (type) => {
    expect(tol[type]).toBe(10);
  });
});
