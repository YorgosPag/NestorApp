jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-375 Phase C.1+C.2 — BIM Pen Table Store tests.
 *
 * C.1: setCell / resetCell / resetAll mutations, resolver injection.
 * C.2: applyPreset, activePresetName tracking, Construction = empty overrides.
 * Firestore service is mocked (no network calls).
 */

// ── Service mock ───────────────────────────────────────────────────────────

jest.mock('../../services/bim-pen-table.service', () => ({
  savePenTableOverrides: jest.fn().mockResolvedValue(undefined),
  subscribePenTableOverrides: jest.fn((_, onChange) => {
    onChange({ overrides: null, activePresetName: null });
    return jest.fn();
  }),
}));

// ── Resolver spy ───────────────────────────────────────────────────────────

import { setPenTableSource } from '../../config/bim-line-weight-resolver';
jest.mock('../../config/bim-line-weight-resolver', () => {
  const actual = jest.requireActual('../../config/bim-line-weight-resolver');
  return { ...actual, setPenTableSource: jest.fn() };
});

// ── Store + helpers ────────────────────────────────────────────────────────

import { useBimPenTableStore } from '../bim-pen-table-store';
import { PEN_TABLE_MM } from '../../config/bim-pen-table';
import { buildEffectivePenTable } from '../../config/bim-pen-table-types';
import { BIM_PEN_SETS, penSetToOverrides } from '../../config/bim-pen-sets';
import { LINEWEIGHT_ISO_VALUES } from '../../config/lineweight-iso-catalog';

const getState = () => useBimPenTableStore.getState();

function resetStore(): void {
  useBimPenTableStore.setState({
    overrides: null,
    effectivePenTable: PEN_TABLE_MM,
    currentCompanyId: null,
    activePresetName: 'construction',
  });
  (setPenTableSource as jest.Mock).mockClear();
}

// ── Phase C.1 tests ────────────────────────────────────────────────────────

describe('BimPenTableStore — Phase C.1', () => {
  beforeEach(() => resetStore());

  it('1. initial state: effectivePenTable === PEN_TABLE_MM', () => {
    expect(getState().effectivePenTable).toBe(PEN_TABLE_MM);
    expect(getState().overrides).toBeNull();
    expect(getState().currentCompanyId).toBeNull();
  });

  it('2. setCell updates effectivePenTable and calls setPenTableSource', () => {
    const store = getState();
    store.setCell(1, 0, 0.09);
    const after = getState();
    expect(after.effectivePenTable[0][0]).toBeCloseTo(0.09);
    expect(after.overrides).toEqual({ 1: { 0: 0.09 } });
    expect(setPenTableSource).toHaveBeenCalledTimes(1);
  });

  it('3. setCell with invalid mm (not in ISO catalog) is silently ignored', () => {
    getState().setCell(1, 0, 0.11);
    const after = getState();
    expect(after.overrides).toBeNull();
    expect(setPenTableSource).not.toHaveBeenCalled();
  });

  it('4. resetCell removes override and reverts to PEN_TABLE_MM default', () => {
    getState().setCell(2, 1, 0.18);
    getState().resetCell(2, 1);
    const after = getState();
    expect(after.effectivePenTable[1][1]).toBeCloseTo(PEN_TABLE_MM[1][1]);
    expect(after.overrides).toEqual({});
  });

  it('5. resetAll clears all overrides', () => {
    getState().setCell(1, 0, 0.09);
    getState().setCell(3, 2, 0.25);
    getState().resetAll();
    const after = getState();
    expect(after.overrides).toEqual({});
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

  it('10. resetCell on non-overridden cell yields correct default mm', () => {
    getState().resetCell(5, 2);
    const after = getState();
    expect(after.effectivePenTable[4][2]).toBeCloseTo(PEN_TABLE_MM[4][2]);
  });
});

// ── Phase C.2 tests ────────────────────────────────────────────────────────

describe('BimPenTableStore — Phase C.2 (Pen Sets)', () => {
  beforeEach(() => resetStore());

  it('11. initial activePresetName is construction', () => {
    expect(getState().activePresetName).toBe('construction');
  });

  it('12. applyPreset(design) sets activePresetName to design', () => {
    getState().applyPreset('design');
    expect(getState().activePresetName).toBe('design');
  });

  it('13. applyPreset(presentation) sets activePresetName to presentation', () => {
    getState().applyPreset('presentation');
    expect(getState().activePresetName).toBe('presentation');
  });

  it('14. applyPreset(construction) → overrides empty (preset equals defaults)', () => {
    getState().applyPreset('construction');
    expect(getState().overrides).toEqual({});
    expect(getState().activePresetName).toBe('construction');
  });

  it('15. setCell after applyPreset(design) → activePresetName becomes custom', () => {
    getState().applyPreset('design');
    getState().setCell(1, 0, 0.09);
    expect(getState().activePresetName).toBe('custom');
  });

  it('16. resetCell → activePresetName becomes custom', () => {
    getState().setCell(3, 1, 0.25);
    useBimPenTableStore.setState({ activePresetName: 'design' });
    getState().resetCell(3, 1);
    expect(getState().activePresetName).toBe('custom');
  });

  it('17. resetAll → activePresetName becomes construction', () => {
    getState().applyPreset('presentation');
    getState().resetAll();
    expect(getState().activePresetName).toBe('construction');
    expect(getState().overrides).toEqual({});
  });

  it('18. applyPreset(design) effectivePenTable differs from PEN_TABLE_MM', () => {
    getState().applyPreset('design');
    const effective = getState().effectivePenTable;
    const designTable = BIM_PEN_SETS.design;
    expect(effective).toEqual(designTable);
  });

  it('19. applyPreset(presentation) effectivePenTable differs from PEN_TABLE_MM', () => {
    getState().applyPreset('presentation');
    const effective = getState().effectivePenTable;
    const presTable = BIM_PEN_SETS.presentation;
    expect(effective).toEqual(presTable);
  });

  it('20. loadForCompany with Firestore activePresetName restores preset', () => {
    const { subscribePenTableOverrides } = jest.requireMock('../../services/bim-pen-table.service');
    subscribePenTableOverrides.mockImplementationOnce((_: string, onChange: (s: { overrides: null; activePresetName: string }) => void) => {
      onChange({ overrides: null, activePresetName: 'design' });
      return jest.fn();
    });
    getState().loadForCompany('co_xyz');
    expect(getState().activePresetName).toBe('design');
  });
});

// ── bim-pen-sets.ts unit tests ─────────────────────────────────────────────

describe('bim-pen-sets — preset definitions', () => {
  it('21. penSetToOverrides(construction) returns empty object', () => {
    const overrides = penSetToOverrides('construction');
    expect(Object.keys(overrides)).toHaveLength(0);
  });

  it('22. penSetToOverrides(design) returns non-empty overrides', () => {
    const overrides = penSetToOverrides('design');
    expect(Object.keys(overrides).length).toBeGreaterThan(0);
  });

  it('23. penSetToOverrides(presentation) returns non-empty overrides', () => {
    const overrides = penSetToOverrides('presentation');
    expect(Object.keys(overrides).length).toBeGreaterThan(0);
  });

  it('24. all design preset values are valid ISO catalog values', () => {
    BIM_PEN_SETS.design.forEach((row) => {
      row.forEach((val) => {
        const inCatalog = (LINEWEIGHT_ISO_VALUES as readonly number[]).some(
          (v) => Math.abs(v - val) < 0.005,
        );
        expect(inCatalog).toBe(true);
      });
    });
  });

  it('25. all presentation preset values are valid ISO catalog values', () => {
    BIM_PEN_SETS.presentation.forEach((row) => {
      row.forEach((val) => {
        const inCatalog = (LINEWEIGHT_ISO_VALUES as readonly number[]).some(
          (v) => Math.abs(v - val) < 0.005,
        );
        expect(inCatalog).toBe(true);
      });
    });
  });
});
