/**
 * ADR-469 v1.2 — orphaned-target latch (SSoT, root-cause #2 of the recurring ADR-293
 * `canonicalScenePath is required` throw on file-less / orphaned floors).
 *
 * A floor whose `sceneFileId` points at a deleted `files`/`cadFiles` doc has NO DXF
 * floorplan blob to persist — its BIM lives in floorId-keyed per-entity collections.
 * DXF scene auto-save must therefore be fully suppressed for it, WITHOUT breaking the
 * normal auto-save of file-linked floorplans. Two belts prove that here:
 *   - belt #1 (gate): a pre-latched fileId never schedules a save.
 *   - belt #2 (resolve safety net): an injected fileId whose `getFileStoragePath`
 *     resolves to null is latched + skipped instead of throwing ADR-293.
 *   - regression: a file-linked floorplan with a resolvable path still saves.
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
    // Orphaned by default: the backing file doc is gone → no storagePath.
    getFileStoragePath: jest.fn().mockResolvedValue(null),
    deriveScenePath: jest.fn().mockReturnValue('scenes/test.json'),
  },
}));

const mockAutoSaveV2 = DxfFirestoreService.autoSaveV2 as jest.Mock;
const mockGetFileStoragePath = DxfFirestoreService.getFileStoragePath as jest.Mock;

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

describe('useAutoSaveSceneManager — orphaned-target latch (ADR-469 v1.2)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAutoSaveV2.mockClear();
    mockGetFileStoragePath.mockClear();
    mockGetFileStoragePath.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('belt #1: a pre-latched (orphaned) fileId never schedules autoSaveV2', async () => {
    const { result } = renderHook(() => useAutoSaveSceneManager());

    act(() => {
      result.current.setCurrentFileName('orphan.dxf');
      result.current.setFileRecordId('file_orphan');
      result.current.markFileTargetOrphaned('file_orphan');
    });
    act(() => {
      result.current.setLevelScene(LEVEL, sceneWith(3), 'local-edit');
    });

    await flushDebouncedSave();

    // Scene still updated in memory (UI must reflect the edit)...
    expect(result.current.getLevelScene(LEVEL)?.entities.length).toBe(3);
    // ...but the gate suppressed the save entirely → no ADR-293 throw path reached.
    expect(mockAutoSaveV2).not.toHaveBeenCalled();
    expect(result.current.isFileTargetOrphaned('file_orphan')).toBe(true);
  });

  it('belt #2: injected fileId with no storagePath is latched + skipped (no throw)', async () => {
    const { result } = renderHook(() => useAutoSaveSceneManager());

    act(() => {
      result.current.setCurrentFileName('gone.dxf');
      result.current.setFileRecordId('file_gone'); // known id, but backing doc deleted
    });
    act(() => {
      result.current.setLevelScene(LEVEL, sceneWith(2), 'local-edit');
    });

    await flushDebouncedSave();

    // Resolve hit the dead-end (getFileStoragePath → null) → skip, not throw.
    expect(mockGetFileStoragePath).toHaveBeenCalledWith('file_gone');
    expect(mockAutoSaveV2).not.toHaveBeenCalled();
    // The safety net latched it, so future edits are hard-suppressed by the gate.
    expect(result.current.isFileTargetOrphaned('file_gone')).toBe(true);

    act(() => {
      result.current.setLevelScene(LEVEL, sceneWith(4), 'local-edit');
    });
    await flushDebouncedSave();
    expect(mockAutoSaveV2).not.toHaveBeenCalled();
  });

  it('regression: a file-linked floorplan with a resolvable path still saves', async () => {
    const { result } = renderHook(() => useAutoSaveSceneManager());

    act(() => {
      result.current.setCurrentFileName('real.dxf');
      // Wizard/loader injected a real canonical path → normal floorplan.
      result.current.setSaveContext({ companyId: 'co1', canonicalScenePath: 'scenes/real.json' });
    });
    act(() => {
      result.current.setLevelScene(LEVEL, sceneWith(3), 'local-edit');
    });

    await flushDebouncedSave();

    expect(mockAutoSaveV2).toHaveBeenCalledTimes(1);
    expect(result.current.isFileTargetOrphaned('file_test_1')).toBe(false);
  });
});
