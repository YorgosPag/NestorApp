/**
 * ADR-040 root-cause #2 — auto-save storm gate.
 *
 * Proves the SSoT `SceneWriteOrigin` gate: a `local-edit` scene write schedules
 * exactly ONE debounced `DxfFirestoreService.autoSaveV2`, while `remote-echo`,
 * `load` and `system-reconcile` writes update in-memory state but NEVER save —
 * which is what stops the ~22-hook snapshot echo storm.
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
    // let the async save body (awaits inside setTimeout) settle
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useAutoSaveSceneManager — SceneWriteOrigin gate (ADR-040)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAutoSaveV2.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('local-edit → schedules exactly ONE autoSaveV2', async () => {
    const { result } = renderHook(() => useAutoSaveSceneManager());

    act(() => {
      result.current.setCurrentFileName('test.dxf');
    });
    act(() => {
      result.current.setLevelScene(LEVEL, sceneWith(3), 'local-edit');
    });

    await flushDebouncedSave();

    expect(mockAutoSaveV2).toHaveBeenCalledTimes(1);
  });

  it.each(['remote-echo', 'load', 'system-reconcile'] as const)(
    '%s → updates state but NEVER calls autoSaveV2',
    async (origin) => {
      const { result } = renderHook(() => useAutoSaveSceneManager());

      act(() => {
        result.current.setCurrentFileName('test.dxf');
      });
      act(() => {
        result.current.setLevelScene(LEVEL, sceneWith(3), origin);
      });

      await flushDebouncedSave();

      // state still updated (UI must reflect remote edits)
      expect(result.current.getLevelScene(LEVEL)?.entities.length).toBe(3);
      // but no save scheduled
      expect(mockAutoSaveV2).not.toHaveBeenCalled();
    },
  );

  it('default origin (omitted 3rd param) behaves as local-edit → saves', async () => {
    const { result } = renderHook(() => useAutoSaveSceneManager());

    act(() => {
      result.current.setCurrentFileName('test.dxf');
    });
    act(() => {
      // backward-compatible: existing call sites pass no origin
      result.current.setLevelScene(LEVEL, sceneWith(2));
    });

    await flushDebouncedSave();

    expect(mockAutoSaveV2).toHaveBeenCalledTimes(1);
  });
});
