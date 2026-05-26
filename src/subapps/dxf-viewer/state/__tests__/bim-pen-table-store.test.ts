jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-375 Phase C.1 — BIM Pen Table Store tests.
 *
 * Verifies: setCell / resetCell / resetAll mutations,
 * resolver injection, and override count tracking.
 * Firestore service is mocked (no network calls).
 */

// ── Service mock ───────────────────────────────────────────────────────────

jest.mock('../../services/bim-pen-table.service', () => ({
  savePenTableOverrides: jest.fn().mockResolvedValue(undefined),
  subscribePenTableOverrides: jest.fn((_, onChange) => {
    onChange(null);        // fire immediately with "no overrides"
    return jest.fn();      // unsubscribe noop
  }),
}));

// ── Resolver spy ───────────────────────────────────────────────────────────

import { setPenTableSource } from '../../config/bim-line-weight-resolver';
jest.mock('../../config/bim-line-weight-resolver', () => {
  const actual = jest.requireActual('../../config/bim-line-weight-resolver');
  return { ...actual, setPenTableSource: jest.fn() };
});

// ── Store ──────────────────────────────────────────────────────────────────

import { useBimPenTableStore } from '../bim-pen-table-store';
import { PEN_TABLE_MM } from '../../config/bim-pen-table';
import { buildEffectivePenTable } from '../../config/bim-pen-table-types';

const getState = () => useBimPenTableStore.getState();

function resetStore(): void {
  useBimPenTableStore.setState({
    overrides: null,
    effectivePenTable: PEN_TABLE_MM,
    currentCompanyId: null,
  });
  (setPenTableSource as jest.Mock).mockClear();
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('BimPenTableStore — Phase C.1', () => {
  beforeEach(() => resetStore());

  it('1. initial state: effectivePenTable === PEN_TABLE_MM', () => {
    expect(getState().effectivePenTable).toBe(PEN_TABLE_MM);
    expect(getState().overrides).toBeNull();
    expect(getState().currentCompanyId).toBeNull();
  });

  it('2. setCell updates effectivePenTable and calls setPenTableSource', () => {
    const store = getState();
    store.setCell(1, 0, 0.09);   // pen #1, col 0 → 0.09mm
    const after = getState();
    expect(after.effectivePenTable[0][0]).toBeCloseTo(0.09);
    expect(after.overrides).toEqual({ 1: { 0: 0.09 } });
    expect(setPenTableSource).toHaveBeenCalledTimes(1);
  });

  it('3. setCell with invalid mm (not in ISO catalog) is silently ignored', () => {
    getState().setCell(1, 0, 0.11); // between 0.09 and 0.13 — not in catalog
    const after = getState();
    expect(after.overrides).toBeNull(); // unchanged (null initial, not mutated)
    expect(setPenTableSource).not.toHaveBeenCalled();
  });

  it('4. resetCell removes override and reverts to PEN_TABLE_MM default', () => {
    getState().setCell(2, 1, 0.18);
    getState().resetCell(2, 1);
    const after = getState();
    // pen #2, col 1 default
    expect(after.effectivePenTable[1][1]).toBeCloseTo(PEN_TABLE_MM[1][1]);
    expect(after.overrides).toEqual({});
  });

  it('5. resetAll clears all overrides', () => {
    getState().setCell(1, 0, 0.09);
    getState().setCell(3, 2, 0.25);
    getState().resetAll();
    const after = getState();
    expect(after.overrides).toEqual({});
    // effective table should equal defaults
    expect(after.effectivePenTable).toEqual(buildEffectivePenTable({}));
  });

  it('6. multiple cells in different pens accumulate correctly', () => {
    getState().setCell(1, 0, 0.09);
    getState().setCell(5, 3, 0.18);
    const after = getState();
    expect(after.overrides).toEqual({ 1: { 0: 0.09 }, 5: { 3: 0.18 } });
  });

  it('7. loadForCompany sets currentCompanyId and subscribes', () => {
    const unsub = getState().loadForCompany('company_test');
    expect(getState().currentCompanyId).toBe('company_test');
    expect(typeof unsub).toBe('function');
  });

  it('8. override count: multiple cells per pen tracked', () => {
    getState().setCell(7, 0, 0.50);
    getState().setCell(7, 1, 0.40);
    getState().setCell(7, 3, 0.35);
    const overrides = getState().overrides;
    const count = overrides
      ? Object.values(overrides).reduce((s, row) => s + Object.keys(row ?? {}).length, 0)
      : 0;
    expect(count).toBe(3);
  });

  it('9. setPenTableSource called on resetAll', () => {
    getState().setCell(1, 0, 0.09);
    (setPenTableSource as jest.Mock).mockClear();
    getState().resetAll();
    expect(setPenTableSource).toHaveBeenCalledTimes(1);
  });

  it('10. resetCell on non-overridden cell still yields default mm values', () => {
    getState().resetCell(5, 2); // not overridden — no-op for data
    const after = getState();
    // effective value equals default (no corruption)
    expect(after.effectivePenTable[4][2]).toBeCloseTo(PEN_TABLE_MM[4][2]);
  });
});
