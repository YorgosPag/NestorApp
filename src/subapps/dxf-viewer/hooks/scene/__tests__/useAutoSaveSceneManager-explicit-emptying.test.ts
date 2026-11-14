/**
 * ADR-714 §2.8 — ο hook ΣΩΖΕΙ το ρητό άδειασμα του χρήστη, και ΜΟΝΟ αυτό.
 *
 * Ζωντανό εύρημα 2026-11-14 (ADR-941 §8.3): Delete της τελευταίας οντότητας / Ctrl+Z
 * εισαγωγής σε άδειο όροφο δεν αποθηκευόταν ποτέ ⇒ μετά την ανανέωση γύριζε το παλιό.
 * Εδώ περνά από ΚΑΙ τους δύο φρουρούς (`!isEmptyScene` στον hook, `isDxfWipe` στον executor,
 * με αποθηκευμένη baseline), ενώ το αποτύπωμα της Ρίζας 5 μένει μπλοκαρισμένο.
 */

import { renderHook, act } from '@testing-library/react';

import { useAutoSaveSceneManager } from '../useAutoSaveSceneManager';
import type { SceneModel } from '../../../types/scene';
import { DxfFirestoreService } from '../../../services/dxf-firestore.service';

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', companyId: 'co1' } }),
}));

jest.mock('../../../services/dxf-firestore.service', () => ({
  DxfFirestoreService: {
    autoSaveV2: jest.fn().mockResolvedValue(true),
    findExistingFileRecord: jest.fn().mockResolvedValue(null),
    generateFileId: jest.fn().mockReturnValue('file_test_1'),
    getFileStoragePath: jest.fn().mockResolvedValue(null),
    deriveScenePath: jest.fn().mockReturnValue('scenes/test.json'),
  },
}));

const mockAutoSaveV2 = DxfFirestoreService.autoSaveV2 as jest.Mock;

const LEVEL = 'lvl1';
const FILE = 'file_test_1';

type SceneEntity = SceneModel['entities'][number];
const entity = (id: string, type: string): SceneEntity =>
  ({ id, type, layerId: 'lyr_1', visible: true }) as unknown as SceneEntity;
const scene = (...entities: SceneEntity[]): SceneModel =>
  ({ entities, layersById: {}, units: 'mm' }) as unknown as SceneModel;

const sixImported = scene(...Array.from({ length: 6 }, (_, i) => entity(`l${i}`, 'line')));
const empty = scene();
const columnOnly = scene(entity('c1', 'column'));

async function flushDebouncedSave() {
  await act(async () => {
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Όροφος φορτωμένος από τον δίσκο με `loaded`, και baseline DXF στον δίσκο `baseline`. */
function loadedFloor(loaded: SceneModel, baseline: number) {
  const hook = renderHook(() => useAutoSaveSceneManager());
  act(() => {
    hook.result.current.setCurrentFileName('test.dxf');
    hook.result.current.setPersistedDxfBaseline(FILE, baseline);
    hook.result.current.setLevelScene(LEVEL, loaded, 'load');
  });
  return hook;
}

describe('useAutoSaveSceneManager — ρητό άδειασμα (ADR-714 §2.8)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAutoSaveV2.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('Ctrl+Z εισαγωγής σε άδειο όροφο (6 ⇒ 0) ⇒ η άδεια σκηνή ΑΠΟΘΗΚΕΥΕΤΑΙ', async () => {
    const { result } = loadedFloor(sixImported, 6);

    act(() => {
      result.current.setLevelScene(LEVEL, empty, 'local-edit');
    });
    await flushDebouncedSave();

    expect(mockAutoSaveV2).toHaveBeenCalledTimes(1);
    expect((mockAutoSaveV2.mock.calls[0][2] as SceneModel).entities).toHaveLength(0);
  });

  it('άδειασμα και κολόνα μέσα στο debounce ⇒ αποθηκεύεται η κολόνα, όχι μπλοκάρισμα dxf-wipe', async () => {
    const { result } = loadedFloor(sixImported, 6);

    act(() => {
      result.current.setLevelScene(LEVEL, empty, 'local-edit');
      result.current.setLevelScene(LEVEL, columnOnly, 'local-edit');
    });
    await flushDebouncedSave();

    expect(mockAutoSaveV2).toHaveBeenCalledTimes(1);
    expect((mockAutoSaveV2.mock.calls[0][2] as SceneModel).entities).toHaveLength(1);
  });

  it('Ρίζα 5: σκηνή μόνο-BIM (τα DXF δεν κατέβηκαν) + τοπική αλλαγή ⇒ ΜΠΛΟΚΑΡΕΤΑΙ όπως πριν', async () => {
    const { result } = loadedFloor(columnOnly, 1181);

    act(() => {
      result.current.setLevelScene(LEVEL, scene(entity('c1', 'column'), entity('c2', 'column')), 'local-edit');
    });
    await flushDebouncedSave();

    expect(mockAutoSaveV2).not.toHaveBeenCalled();
  });

  it('Ρίζα 5: σκηνή μόνο-BIM που αδειάζει ⇒ ΔΕΝ αποθηκεύεται (δεν υπήρχε γεωμετρία να σβηστεί)', async () => {
    const { result } = loadedFloor(columnOnly, 1181);

    act(() => {
      result.current.setLevelScene(LEVEL, empty, 'local-edit');
    });
    await flushDebouncedSave();

    expect(mockAutoSaveV2).not.toHaveBeenCalled();
  });

  it('νέα φόρτωση σβήνει την πρόθεση: άδεια φόρτωση + τοπική αλλαγή χωρίς γεωμετρία ⇒ ΔΕΝ αποθηκεύεται', async () => {
    const { result } = loadedFloor(sixImported, 6);

    act(() => {
      result.current.setLevelScene(LEVEL, empty, 'local-edit');
    });
    await flushDebouncedSave();
    expect(mockAutoSaveV2).toHaveBeenCalledTimes(1);
    mockAutoSaveV2.mockClear();

    act(() => {
      result.current.setLevelScene(LEVEL, empty, 'load');
      result.current.setLevelScene(LEVEL, empty, 'local-edit');
    });
    await flushDebouncedSave();

    expect(mockAutoSaveV2).not.toHaveBeenCalled();
  });
});
