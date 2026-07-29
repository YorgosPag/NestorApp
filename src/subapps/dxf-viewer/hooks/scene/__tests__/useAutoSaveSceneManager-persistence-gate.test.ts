/**
 * ADR-726 §13.1 — persistence master gate (`enablePersistence` → `enabled`).
 *
 * Ο frame-budget harness μοντάρει ΟΛΟΚΛΗΡΟ τον viewer χωρίς auth, ώστε το backend να
 * μείνει **έξω** από τον βρόχο μέτρησης (hermeticity). Πριν από αυτή την πύλη, το
 * σβήσιμο των Firestore subscriptions **δεν αρκούσε**: η πρώτη εισαγωγή καλούσε
 * `setCurrentFileName()` και το auto-save ξεκινούσε εγγραφή σε Storage — μετρημένο στον
 * browser 2026-07-29 (`canonicalScenePath is required` + `autoSaveV2 returned false`).
 *
 * Οι δοκιμές χαρακτηρίζουν **δύο** πράγματα, όχι ένα:
 *  1. `enabled: false` ⇒ καμία εγγραφή, ποτέ.
 *  2. Είναι **σκληρή** πύλη: ο διακόπτης χρήστη (`AutoSaveStatus` → `setAutoSaveEnabled`)
 *     δεν μπορεί να την παρακάμψει. Χωρίς αυτό, το «χωρίς μονιμότητα» θα ήταν απλώς
 *     αρχική τιμή — ένα κλικ μακριά από δικτυακή κίνηση μέσα στη μέτρηση.
 *  3. Η προεπιλογή (καμία παράμετρος) μένει **αμετάβλητη** — άγκυρα παλινδρόμησης για
 *     την παραγωγή, που περνά από το ίδιο μονοπάτι.
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

function sceneWith(n: number): SceneModel {
  return {
    entities: Array.from({ length: n }, (_, i) => ({ id: `e${i}` })),
  } as unknown as SceneModel;
}

/** Drives the hook past the debounce window and flushes the async save body. */
async function flushDebouncedSave() {
  await act(async () => {
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useAutoSaveSceneManager — persistence gate (ADR-726 §13.1)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAutoSaveV2.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('enabled: false → a local-edit write NEVER schedules autoSaveV2', async () => {
    const { result } = renderHook(() => useAutoSaveSceneManager({ enabled: false }));

    act(() => {
      result.current.setCurrentFileName('harness.dxf');
    });
    act(() => {
      result.current.setLevelScene(LEVEL, sceneWith(3), 'local-edit');
    });

    await flushDebouncedSave();

    expect(mockAutoSaveV2).not.toHaveBeenCalled();
  });

  it('enabled: false → the in-memory scene is still updated (the viewer must draw)', async () => {
    const { result } = renderHook(() => useAutoSaveSceneManager({ enabled: false }));

    act(() => {
      result.current.setCurrentFileName('harness.dxf');
    });
    act(() => {
      result.current.setLevelScene(LEVEL, sceneWith(4), 'local-edit');
    });

    await flushDebouncedSave();

    expect(result.current.getLevelScene(LEVEL)?.entities.length).toBe(4);
  });

  it('enabled: false → the user-facing switch reports OFF (no lying widget)', () => {
    const { result } = renderHook(() => useAutoSaveSceneManager({ enabled: false }));

    expect(result.current.autoSaveEnabled).toBe(false);
  });

  it('enabled: false → re-enabling from the UI switch STILL never saves (hard gate)', async () => {
    const { result } = renderHook(() => useAutoSaveSceneManager({ enabled: false }));

    act(() => {
      result.current.setCurrentFileName('harness.dxf');
      // ό,τι κάνει το `AutoSaveStatus` όταν ο χρήστης πατά τον διακόπτη
      result.current.setAutoSaveEnabled(true);
    });
    act(() => {
      result.current.setLevelScene(LEVEL, sceneWith(3), 'local-edit');
    });

    await flushDebouncedSave();

    expect(result.current.autoSaveEnabled).toBe(true);
    expect(mockAutoSaveV2).not.toHaveBeenCalled();
  });

  it('no options (production default) → saves exactly as before the flag existed', async () => {
    const { result } = renderHook(() => useAutoSaveSceneManager());

    act(() => {
      result.current.setCurrentFileName('production.dxf');
    });
    act(() => {
      result.current.setLevelScene(LEVEL, sceneWith(3), 'local-edit');
    });

    await flushDebouncedSave();

    expect(mockAutoSaveV2).toHaveBeenCalledTimes(1);
  });

  it('enabled: true (explicit) → saves', async () => {
    const { result } = renderHook(() => useAutoSaveSceneManager({ enabled: true }));

    act(() => {
      result.current.setCurrentFileName('production.dxf');
    });
    act(() => {
      result.current.setLevelScene(LEVEL, sceneWith(3), 'local-edit');
    });

    await flushDebouncedSave();

    expect(mockAutoSaveV2).toHaveBeenCalledTimes(1);
  });
});
