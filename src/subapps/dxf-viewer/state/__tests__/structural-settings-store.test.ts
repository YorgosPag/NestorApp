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

  it('setCodeId με building → persist (debounced) + stamp mutation', () => {
    jest.useFakeTimers();
    useStructuralSettingsStore.getState().loadForBuilding('bld-2', null);
    useStructuralSettingsStore.getState().setCodeId('greek-legacy');
    expect(useStructuralSettingsStore.getState().lastLocalMutationAt).toBeGreaterThan(0);
    jest.advanceTimersByTime(600);
    expect(mockedSave).toHaveBeenCalledWith('bld-2', expect.objectContaining({ codeId: 'greek-legacy' }));
    jest.useRealTimers();
  });

  it('setCodeId ίδια τιμή = no-op (idempotent)', () => {
    jest.useFakeTimers();
    useStructuralSettingsStore.getState().loadForBuilding('bld-3', { codeId: 'eurocode' });
    useStructuralSettingsStore.getState().setCodeId('eurocode');
    jest.advanceTimersByTime(600);
    expect(mockedSave).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
