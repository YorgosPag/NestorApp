/**
 * ADR-914 §2.9 — **το κενό ανάμεσα στο κλικ και στην ηχώ της συνδρομής.**
 *
 * Μετρημένο 2026-10-11: ένα νέο επίπεδο έμπαινε στη λίστα 6-9 s μετά το κλικ (μόνο όταν το έφερνε
 * το `onSnapshot`), και το πεδίο άμεσης μετονομασίας του πρόχειρου αποδιδόταν **τότε**. Εδώ
 * εκτελούνται οι πραγματικοί τελεστές (`useLevelOperations`) πάνω στο πραγματικό στρώμα
 * (`useLevelOverlay`), με τον διακομιστή ψεύτικο και τη συνδρομή στα χέρια του test.
 */

import { act, renderHook } from '@testing-library/react';

const createLevel = jest.fn();
const updateLevel = jest.fn();

jest.mock('@/services/dxf-level-mutation-gateway', () => ({
  createDxfLevelWithPolicy: (args: unknown) => createLevel(args),
  updateDxfLevelWithPolicy: (args: unknown) => updateLevel(args),
  deleteDxfLevelWithPolicy: jest.fn(() => Promise.resolve({})),
}));
jest.mock('@/services/floor-mutation-gateway', () => ({
  updateFloorWithPolicy: jest.fn(() => Promise.resolve({})),
}));
jest.mock('../../../hooks/scene/useAutoSaveSceneManager', () => ({
  useAutoSaveSceneManager: jest.fn(),
}));

import { DEFAULT_LEVEL_SETTINGS, type Level } from '../config';
import { useLevelOperations } from '../hooks/useLevelOperations';
import { useLevelOverlay } from '../hooks/useLevelOverlay';

const ground: Level = {
  id: 'lvl_ground', name: 'Ισόγειο', order: 0, isDefault: false, visible: true, buildingId: 'bldg_A',
};

const setCurrentLevelId = jest.fn();
const handleError = jest.fn();

/** Το σύστημα επιπέδων χωρίς provider: η «συνδρομή» είναι το `base` που δίνει το test. */
function useLevelsUnderTest(base: Level[]) {
  const { levels, actions } = useLevelOverlay(base);
  const ops = useLevelOperations({
    levels,
    setLevels: jest.fn(),
    overlay: actions,
    currentLevelId: null,
    setCurrentLevelId,
    setFloorplans: jest.fn(),
    enableFirestore: true,
    settings: DEFAULT_LEVEL_SETTINGS,
    sceneManager: {} as Parameters<typeof useLevelOperations>[0]['sceneManager'],
    setIsLoading: jest.fn(),
    handleError,
  });
  return { levels, ops, isAwaitingEcho: actions.isAwaitingEcho };
}

beforeEach(() => {
  jest.clearAllMocks();
  createLevel.mockResolvedValue({ levelId: 'lvl_new' });
  updateLevel.mockResolvedValue({ success: true });
});

describe('γέννηση επιπέδου — στη λίστα μόλις απαντήσει ο διακομιστής', () => {
  it('🔑 το νέο επίπεδο είναι στη λίστα ΠΡΙΝ από οποιαδήποτε ηχώ της συνδρομής', async () => {
    const { result } = renderHook(({ base }) => useLevelsUnderTest(base), { initialProps: { base: [ground] } });

    await act(async () => {
      await result.current.ops.addLevel('Πρόχειρο 1');
    });

    expect(result.current.levels.map((l) => l.id)).toEqual(['lvl_ground', 'lvl_new']);
    expect(result.current.isAwaitingEcho('lvl_new')).toBe(true);
    expect(setCurrentLevelId).toHaveBeenCalledWith('lvl_new');
  });

  it('🔑 `select: false` — το επίπεδο γεννιέται και μπαίνει στη λίστα, αλλά το ανοιχτό ΔΕΝ αλλάζει (ADR-914 §8.13)', async () => {
    const { result } = renderHook(({ base }) => useLevelsUnderTest(base), { initialProps: { base: [ground] } });

    await act(async () => {
      await result.current.ops.addLevel('1ος Όροφος', false, 'flr_1', { buildingId: 'bldg_A' }, { select: false });
    });

    expect(result.current.levels.map((l) => l.id)).toEqual(['lvl_ground', 'lvl_new']);
    expect(setCurrentLevelId).not.toHaveBeenCalled();
  });

  it('κουβαλά ΟΛΗ τη δέσμευση του αιτήματος — ο στόχος γέννησης (ADR-913) βγαίνει ίδιος πριν και μετά', async () => {
    const { result } = renderHook(({ base }) => useLevelsUnderTest(base), { initialProps: { base: [ground] } });

    await act(async () => {
      await result.current.ops.addLevel('Κάτοψη Α1', false, 'flr_1', {
        buildingId: 'bldg_A', projectId: 'proj_1', propertyId: 'prop_1', floorplanType: 'unit', entityLabel: 'Α1',
      });
    });

    const sent = createLevel.mock.calls[0][0].payload;
    const born = result.current.levels.find((l) => l.id === 'lvl_new');
    expect(born).toMatchObject({
      floorId: sent.floorId,
      buildingId: sent.buildingId,
      projectId: sent.projectId,
      propertyId: sent.propertyId,
      floorplanType: sent.floorplanType,
      order: sent.order,
      name: sent.name,
    });
  });

  it('η ηχώ ΔΕΝ το διπλασιάζει και το βγάζει από το στρώμα', async () => {
    const { result, rerender } = renderHook(({ base }) => useLevelsUnderTest(base), {
      initialProps: { base: [ground] },
    });
    await act(async () => {
      await result.current.ops.addLevel('Πρόχειρο 1');
    });

    const echoed: Level = { id: 'lvl_new', name: 'Πρόχειρο 1', order: 1, isDefault: false, visible: true, companyId: 'comp_1' };
    rerender({ base: [ground, echoed] });

    expect(result.current.levels.filter((l) => l.id === 'lvl_new')).toEqual([echoed]);
    expect(result.current.isAwaitingEcho('lvl_new')).toBe(false);
  });

  it('αποτυχημένη δημιουργία δεν αφήνει τίποτα στη λίστα', async () => {
    createLevel.mockRejectedValueOnce(new Error('409'));
    const { result } = renderHook(({ base }) => useLevelsUnderTest(base), { initialProps: { base: [ground] } });

    await act(async () => {
      expect(await result.current.ops.addLevel('Πρόχειρο 1')).toBeNull();
    });

    expect(result.current.levels).toEqual([ground]);
    expect(handleError).toHaveBeenCalled();
  });
});

describe('μετονομασία — το νέο όνομα φαίνεται αμέσως', () => {
  it('🔑 επίπεδο που ΔΕΝ έχει αντηχήσει ακόμη μετονομάζεται — το σενάριο του πρόχειρου', async () => {
    const { result } = renderHook(({ base }) => useLevelsUnderTest(base), { initialProps: { base: [ground] } });
    await act(async () => {
      await result.current.ops.addLevel('Πρόχειρο 1');
    });

    await act(async () => {
      await result.current.ops.renameLevel('lvl_new', 'Μελέτη όψεων');
    });

    expect(updateLevel).toHaveBeenCalledWith({ payload: { levelId: 'lvl_new', name: 'Μελέτη όψεων' } });
    expect(result.current.levels.find((l) => l.id === 'lvl_new')?.name).toBe('Μελέτη όψεων');
  });

  it('αν η εγγραφή αποτύχει, το παλιό όνομα επιστρέφει και το σφάλμα αναφέρεται', async () => {
    updateLevel.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(({ base }) => useLevelsUnderTest(base), { initialProps: { base: [ground] } });

    await act(async () => {
      await result.current.ops.renameLevel('lvl_ground', 'Pilotis');
    });

    expect(result.current.levels[0].name).toBe('Ισόγειο');
    expect(handleError).toHaveBeenCalled();
  });
});
