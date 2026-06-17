/**
 * ADR-456 Slice 2b — structural-settings-store tests.
 *
 * Επιβεβαιώνει: defaults, building load/resolve, in-memory setters χωρίς
 * persistence όταν δεν υπάρχει building, και idempotent no-op writes. Το service
 * είναι mocked ώστε να μην ενεργοποιείται πραγματικό building write.
 */

import { useStructuralSettingsStore } from '../structural-settings-store';

jest.mock('../../services/structural-settings.service', () => ({
  saveStructuralSettings: jest.fn().mockResolvedValue(undefined),
}));

import { saveStructuralSettings } from '../../services/structural-settings.service';

const mockedSave = saveStructuralSettings as jest.MockedFunction<typeof saveStructuralSettings>;

function reset(): void {
  useStructuralSettingsStore.getState().loadForBuilding(null, null);
  mockedSave.mockClear();
}

/**
 * Flush της microtask ουράς: η debounced persistence φορτώνει lazy το service
 * (`void import('../../services/structural-settings.service')`) → το `saveStructuralSettings`
 * καλείται σε microtask ΜΕΤΑ το `advanceTimersByTime` (το import resolve + `.then`). Τα
 * fake timers δεν μπλοκάρουν τη native microtask ουρά, οπότε λίγα awaits την αδειάζουν.
 */
async function flushMicrotasks(times = 5): Promise<void> {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

describe('structural-settings-store', () => {
  beforeEach(reset);

  it('default state = eurocode / C25/30 / no building', () => {
    const s = useStructuralSettingsStore.getState();
    expect(s.codeId).toBe('eurocode');
    expect(s.defaultConcreteGrade).toBe('C25/30');
    expect(s.currentBuildingId).toBeNull();
  });

  it('loadForBuilding κανονικοποιεί + θέτει το ενεργό building', () => {
    useStructuralSettingsStore.getState().loadForBuilding('bld-1', { codeId: 'greek-legacy' });
    const s = useStructuralSettingsStore.getState();
    expect(s.codeId).toBe('greek-legacy');
    expect(s.defaultConcreteGrade).toBe('C25/30'); // απών → default
    expect(s.currentBuildingId).toBe('bld-1');
  });

  it('loadForBuilding με άκυρα → defaults', () => {
    useStructuralSettingsStore.getState().loadForBuilding('bld-x', {
      codeId: 'bogus' as never,
      defaultConcreteGrade: 'C999' as never,
    });
    const s = useStructuralSettingsStore.getState();
    expect(s.codeId).toBe('eurocode');
    expect(s.defaultConcreteGrade).toBe('C25/30');
  });

  it('setCodeId χωρίς building = in-memory, χωρίς persistence', () => {
    useStructuralSettingsStore.getState().setCodeId('greek-legacy');
    expect(useStructuralSettingsStore.getState().codeId).toBe('greek-legacy');
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it('setCodeId με building → persist (debounced) + stamp mutation', async () => {
    jest.useFakeTimers();
    useStructuralSettingsStore.getState().loadForBuilding('bld-2', null);
    useStructuralSettingsStore.getState().setCodeId('greek-legacy');
    expect(useStructuralSettingsStore.getState().lastLocalMutationAt).toBeGreaterThan(0);
    jest.advanceTimersByTime(600);
    await flushMicrotasks(); // lazy import() → save σε microtask
    expect(mockedSave).toHaveBeenCalledWith('bld-2', expect.objectContaining({ codeId: 'greek-legacy' }));
    jest.useRealTimers();
  });

  it('setCodeId ίδια τιμή = no-op (idempotent)', async () => {
    jest.useFakeTimers();
    useStructuralSettingsStore.getState().loadForBuilding('bld-3', { codeId: 'eurocode' });
    useStructuralSettingsStore.getState().setCodeId('eurocode');
    jest.advanceTimersByTime(600);
    await flushMicrotasks();
    expect(mockedSave).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
