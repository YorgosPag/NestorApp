/**
 * ADR-370 — ExtendedSnapType BIM_CORNER (generic) tests.
 *
 * After the 5→1 collapse, the 5 per-entity BIM_*_CORNER types are replaced by ONE
 * generic `BIM_CORNER`. Verifies:
 *   - BIM_CORNER enum value + string literal.
 *   - The 5 old per-entity corner types are GONE.
 *   - BIM_CORNER is in enabledTypes, before BIM_COLUMN_CENTER in priority, tolerance 10.
 *   - BIM_COLUMN_CENTER still present (regression guard).
 */

import { ExtendedSnapType, DEFAULT_PRO_SNAP_SETTINGS } from '../../extended-types';

describe('ExtendedSnapType — BIM_CORNER (generic, replaces 5 per-entity types)', () => {
  it('BIM_CORNER = "bim_corner"', () => {
    expect(ExtendedSnapType.BIM_CORNER).toBe('bim_corner');
  });

  it('the 5 old per-entity corner types no longer exist', () => {
    const e = ExtendedSnapType as Record<string, string | undefined>;
    expect(e.BIM_WALL_CORNER).toBeUndefined();
    expect(e.BIM_BEAM_CORNER).toBeUndefined();
    expect(e.BIM_SLAB_CORNER).toBeUndefined();
    expect(e.BIM_COLUMN_CORNER).toBeUndefined();
    expect(e.BIM_OPENING_CORNER).toBeUndefined();
  });

  it('BIM_COLUMN_CENTER still present (regression guard)', () => {
    expect(ExtendedSnapType.BIM_COLUMN_CENTER).toBe('bim_column_center');
  });
});

describe('DEFAULT_PRO_SNAP_SETTINGS — BIM_CORNER wiring', () => {
  it('BIM_CORNER is in enabledTypes', () => {
    expect(DEFAULT_PRO_SNAP_SETTINGS.enabledTypes.has(ExtendedSnapType.BIM_CORNER)).toBe(true);
  });

  it('BIM_COLUMN_CENTER still in enabledTypes (regression guard)', () => {
    expect(DEFAULT_PRO_SNAP_SETTINGS.enabledTypes.has(ExtendedSnapType.BIM_COLUMN_CENTER)).toBe(true);
  });

  it('BIM_CORNER appears in the priority list before BIM_COLUMN_CENTER', () => {
    const priority = DEFAULT_PRO_SNAP_SETTINGS.priority;
    const cornerIdx = priority.indexOf(ExtendedSnapType.BIM_CORNER);
    const centerIdx = priority.indexOf(ExtendedSnapType.BIM_COLUMN_CENTER);
    expect(cornerIdx).toBeGreaterThan(-1);
    expect(centerIdx).toBeGreaterThan(-1);
    expect(cornerIdx).toBeLessThan(centerIdx);
  });

  it('BIM_CORNER perModePxTolerance = 10', () => {
    expect(DEFAULT_PRO_SNAP_SETTINGS.perModePxTolerance![ExtendedSnapType.BIM_CORNER]).toBe(10);
  });
});
