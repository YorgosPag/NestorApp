/**
 * ADR-370 — ExtendedSnapType BIM characteristic-point types (generic) tests.
 *
 * After the consolidation, the 5 per-entity `BIM_*_CORNER` types AND the old
 * `BIM_COLUMN_CENTER` are replaced by 3 generic types: `BIM_CORNER` / `BIM_MIDPOINT` /
 * `BIM_CENTER`. Verifies the enum + `DEFAULT_PRO_SNAP_SETTINGS` wiring.
 */

import { ExtendedSnapType, DEFAULT_PRO_SNAP_SETTINGS } from '../../extended-types';

describe('ExtendedSnapType — generic BIM characteristic-point types', () => {
  it('BIM_CORNER / BIM_MIDPOINT / BIM_CENTER exist with their string literals', () => {
    expect(ExtendedSnapType.BIM_CORNER).toBe('bim_corner');
    expect(ExtendedSnapType.BIM_MIDPOINT).toBe('bim_midpoint');
    expect(ExtendedSnapType.BIM_CENTER).toBe('bim_center');
  });

  it('the old per-entity corner types AND BIM_COLUMN_CENTER no longer exist', () => {
    const e = ExtendedSnapType as Record<string, string | undefined>;
    expect(e.BIM_WALL_CORNER).toBeUndefined();
    expect(e.BIM_BEAM_CORNER).toBeUndefined();
    expect(e.BIM_SLAB_CORNER).toBeUndefined();
    expect(e.BIM_COLUMN_CORNER).toBeUndefined();
    expect(e.BIM_OPENING_CORNER).toBeUndefined();
    expect(e.BIM_COLUMN_CENTER).toBeUndefined();
  });
});

describe('DEFAULT_PRO_SNAP_SETTINGS — BIM characteristic-point wiring', () => {
  it('all 3 generic types are in enabledTypes', () => {
    expect(DEFAULT_PRO_SNAP_SETTINGS.enabledTypes.has(ExtendedSnapType.BIM_CORNER)).toBe(true);
    expect(DEFAULT_PRO_SNAP_SETTINGS.enabledTypes.has(ExtendedSnapType.BIM_MIDPOINT)).toBe(true);
    expect(DEFAULT_PRO_SNAP_SETTINGS.enabledTypes.has(ExtendedSnapType.BIM_CENTER)).toBe(true);
  });

  it('BIM_CORNER (structural corner) outranks BIM_MIDPOINT and BIM_CENTER in priority', () => {
    const priority = DEFAULT_PRO_SNAP_SETTINGS.priority;
    const corner = priority.indexOf(ExtendedSnapType.BIM_CORNER);
    const mid = priority.indexOf(ExtendedSnapType.BIM_MIDPOINT);
    const center = priority.indexOf(ExtendedSnapType.BIM_CENTER);
    expect(corner).toBeGreaterThan(-1);
    expect(mid).toBeGreaterThan(-1);
    expect(center).toBeGreaterThan(-1);
    expect(corner).toBeLessThan(mid);
    expect(corner).toBeLessThan(center);
  });

  it('BIM_MIDPOINT and BIM_CENTER run BEFORE the generic point engines (anti-starvation)', () => {
    // The orchestrator iterates `priority` and stops at maxCandidates (8). If the dense-DXF
    // flooders (INTERSECTION/ENDPOINT/MIDPOINT/NEAREST) precede the always-on BIM structural
    // snaps, those engines never run → «Μέσο/Κέντρο never appear». Guard the iteration order.
    const priority = DEFAULT_PRO_SNAP_SETTINGS.priority;
    const mid = priority.indexOf(ExtendedSnapType.BIM_MIDPOINT);
    const center = priority.indexOf(ExtendedSnapType.BIM_CENTER);
    const intersection = priority.indexOf(ExtendedSnapType.INTERSECTION);
    const endpoint = priority.indexOf(ExtendedSnapType.ENDPOINT);
    const genericMid = priority.indexOf(ExtendedSnapType.MIDPOINT);
    const nearest = priority.indexOf(ExtendedSnapType.NEAREST);
    for (const flooder of [intersection, endpoint, genericMid, nearest]) {
      expect(mid).toBeLessThan(flooder);
      expect(center).toBeLessThan(flooder);
    }
  });

  it('all 3 generic types have perModePxTolerance = 10', () => {
    const tol = DEFAULT_PRO_SNAP_SETTINGS.perModePxTolerance!;
    expect(tol[ExtendedSnapType.BIM_CORNER]).toBe(10);
    expect(tol[ExtendedSnapType.BIM_MIDPOINT]).toBe(10);
    expect(tol[ExtendedSnapType.BIM_CENTER]).toBe(10);
  });
});
