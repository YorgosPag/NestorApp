/**
 * Tests for opening-hardware-boq-sync's `sumFloorplanHardware` (pure) — ADR-674
 * rev.3: family-TYPE-level `hardwareOverrides` reaching the σιδερικά BOQ.
 *
 * Focus: `HardwareBoqOpening.typeParams` is now folded via
 * `resolveOpeningHardwareSet(params, typeParams)` (catalog default → type
 * override → instance override, LAST wins). No Firestore I/O — pure summation,
 * so no mocks are needed.
 *
 * @see ../opening-hardware-boq-sync.ts
 * @see ../../family-types/opening-hardware-set.ts — the fold SSoT under test
 */

import { sumFloorplanHardware, type HardwareBoqOpening } from '../opening-hardware-boq-sync';
import type { OpeningKind, OpeningParams } from '../../types/opening-types';
import type { OpeningTypeParams } from '../../types/bim-family-type';

function makeParams(kind: OpeningKind, overrides: Partial<OpeningParams> = {}): OpeningParams {
  return {
    kind,
    wallId: 'wall-1',
    offsetFromStart: 500,
    width: 900,
    height: 2100,
    sillHeight: 0,
    ...overrides,
  } as OpeningParams;
}

function makeTypeParams(kind: OpeningKind, overrides: Partial<OpeningTypeParams> = {}): OpeningTypeParams {
  return {
    kind,
    width: 900,
    height: 2100,
    ...overrides,
  } as OpeningTypeParams;
}

describe('sumFloorplanHardware — family-type hardwareOverrides fold (ADR-674 rev.3)', () => {
  it('a type-level hinge override increases the summed total when the instance has none', () => {
    const opening: HardwareBoqOpening = {
      params: makeParams('door'),
      typeParams: makeTypeParams('door', { hardwareOverrides: { hinge: 4 } }),
    };
    const totals = sumFloorplanHardware([opening]);
    // Catalog default for 'door' is hinge:3 — type override bumps it to 4.
    expect(totals.get('hinge')).toBe(4);
    // Untouched components stay at catalog default.
    expect(totals.get('lever')).toBe(1);
    expect(totals.get('lockset')).toBe(1);
  });

  it('an instance override wins over a type override for the same component', () => {
    const opening: HardwareBoqOpening = {
      params: makeParams('door', { hardwareOverrides: { hinge: 6 } }),
      typeParams: makeTypeParams('door', { hardwareOverrides: { hinge: 4 } }),
    };
    const totals = sumFloorplanHardware([opening]);
    // Instance (6) beats type (4) beats catalog (3) — LAST wins.
    expect(totals.get('hinge')).toBe(6);
  });

  it('a door with no overrides at all sums the catalog default', () => {
    const opening: HardwareBoqOpening = { params: makeParams('door') };
    const totals = sumFloorplanHardware([opening]);
    expect(totals.get('hinge')).toBe(3);
    expect(totals.get('lever')).toBe(1);
    expect(totals.get('lockset')).toBe(1);
  });

  it('a type override of 0 removes the component from the sum', () => {
    const opening: HardwareBoqOpening = {
      params: makeParams('door'),
      typeParams: makeTypeParams('door', { hardwareOverrides: { lockset: 0 } }),
    };
    const totals = sumFloorplanHardware([opening]);
    expect(totals.has('lockset')).toBe(false);
    // Siblings unaffected.
    expect(totals.get('hinge')).toBe(3);
    expect(totals.get('lever')).toBe(1);
  });

  it('aggregates a type override across multiple openings sharing the type', () => {
    const typeParams = makeTypeParams('door', { hardwareOverrides: { hinge: 4 } });
    const totals = sumFloorplanHardware([
      { params: makeParams('door'), typeParams },
      { params: makeParams('door'), typeParams },
    ]);
    expect(totals.get('hinge')).toBe(8); // 2 doors × 4 (type override, not catalog 3)
  });
});
