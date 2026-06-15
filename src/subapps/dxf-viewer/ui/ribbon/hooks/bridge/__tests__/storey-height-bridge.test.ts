/**
 * ADR-451 Slice 4 — storey-height-bridge tests.
 *
 * Καλύπτει: key guard, pure resolve/parse, store-backed combobox state, και ότι
 * το write στέλνει floor.height σε **μέτρα** στο gateway (ΙΔΙΟ SSoT με Κτίρια→Όροφοι).
 */

import {
  STOREY_RIBBON_KEYS,
  isStoreyRibbonKey,
  resolveStoreyHeightState,
  parseStoreyHeightMetres,
  getStoreyComboboxState,
  applyStoreyComboboxChange,
} from '../storey-height-bridge';
import type { ActiveStoreyContext } from '../../../../../systems/levels/active-storey-context';

jest.mock('@/services/floor-mutation-gateway', () => ({
  updateFloorWithPolicy: jest.fn(() => Promise.resolve({ success: true })),
}));
import { updateFloorWithPolicy } from '@/services/floor-mutation-gateway';
import { useActiveStoreyStore as store } from '../../../../../systems/levels/active-storey-store';

const ctx = (over: Partial<ActiveStoreyContext> = {}): ActiveStoreyContext => ({
  floorId: 'flr_test',
  storeyKind: null,
  storeyNumber: 0,
  storeyHeightMm: 3000,
  finishThicknessMm: 50,
  floorElevationMm: 0,
  nextFloorElevationMm: 3000,
  isLowestOccupiedStorey: true,
  buildingHasBasement: false,
  ...over,
});

afterEach(() => {
  store.getState().setContext(null);
  (updateFloorWithPolicy as jest.Mock).mockClear();
});

describe('isStoreyRibbonKey', () => {
  it('αναγνωρίζει το storey height key, ΟΧΙ column keys', () => {
    expect(isStoreyRibbonKey(STOREY_RIBBON_KEYS.height)).toBe(true);
    expect(isStoreyRibbonKey('column.params.height')).toBe(false);
  });
});

describe('resolveStoreyHeightState (pure)', () => {
  it('null context → disabled, κενή τιμή', () => {
    expect(resolveStoreyHeightState(null)).toEqual({ value: '', options: [], disabled: true });
  });
  it('context → storeyHeightMm ως τιμή', () => {
    expect(resolveStoreyHeightState(ctx({ storeyHeightMm: 3300 }))).toEqual({ value: '3300', options: [] });
  });
});

describe('parseStoreyHeightMetres (pure)', () => {
  it('mm → μέτρα', () => {
    expect(parseStoreyHeightMetres('3000')).toBe(3);
    expect(parseStoreyHeightMetres('2700')).toBe(2.7);
  });
  it('άκυρο / μη-θετικό → null', () => {
    expect(parseStoreyHeightMetres('abc')).toBeNull();
    expect(parseStoreyHeightMetres('0')).toBeNull();
    expect(parseStoreyHeightMetres('-100')).toBeNull();
  });
});

describe('getStoreyComboboxState (store-backed)', () => {
  it('διαβάζει το ενεργό storey height', () => {
    store.getState().setContext(ctx({ storeyHeightMm: 2700 }));
    expect(getStoreyComboboxState(STOREY_RIBBON_KEYS.height)).toEqual({ value: '2700', options: [] });
  });
  it('μη-storey key → null', () => {
    expect(getStoreyComboboxState('column.params.height')).toBeNull();
  });
});

describe('applyStoreyComboboxChange (write → gateway)', () => {
  it('στέλνει floor.height σε ΜΕΤΡΑ στο gateway', () => {
    store.getState().setContext(ctx({ floorId: 'flr_abc' }));
    applyStoreyComboboxChange(STOREY_RIBBON_KEYS.height, '3300');
    expect(updateFloorWithPolicy).toHaveBeenCalledWith({ payload: { floorId: 'flr_abc', height: 3.3 } });
  });
  it('χωρίς active storey → no-op', () => {
    applyStoreyComboboxChange(STOREY_RIBBON_KEYS.height, '3300');
    expect(updateFloorWithPolicy).not.toHaveBeenCalled();
  });
  it('άκυρη τιμή → no-op', () => {
    store.getState().setContext(ctx());
    applyStoreyComboboxChange(STOREY_RIBBON_KEYS.height, 'xyz');
    expect(updateFloorWithPolicy).not.toHaveBeenCalled();
  });
});
