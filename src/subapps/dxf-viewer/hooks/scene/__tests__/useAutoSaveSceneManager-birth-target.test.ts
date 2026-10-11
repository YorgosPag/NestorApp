/**
 * ADR-913 — στόχος γέννησης μέσα από τον ΠΡΑΓΜΑΤΙΚΟ manager + executor.
 *
 * Mock είναι μόνο το σύνορο του δικτύου (`DxfFirestoreService`): ticket, πύλη, debounce και
 * executor εκτελούνται αυτούσια. Ελέγχεται ό,τι φτάνει στο `autoSaveV2` — δηλαδή ΠΟΥ γράφεται.
 */

import { renderHook, act } from '@testing-library/react';

import { useAutoSaveSceneManager } from '../useAutoSaveSceneManager';
import type { SceneModel } from '../../../types/scene';
import { DxfFirestoreService } from '../../../services/dxf-firestore.service';
import { resolveLevelDrawingBirthTarget } from '../../../systems/levels/level-drawing-birth';
import { openFileLessLevelTarget } from '../../../systems/levels/level-file-less-target';

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', companyId: 'co1' } }),
}));

jest.mock('../../../services/dxf-firestore.service', () => ({
  DxfFirestoreService: {
    autoSaveV2: jest.fn().mockResolvedValue(true),
    findExistingFileRecord: jest.fn().mockResolvedValue(null),
    generateFileId: jest.fn().mockReturnValue('file_random'),
    getFileFloorScope: jest.fn().mockResolvedValue(null),
    findFloorFloorplanFileRecord: jest.fn().mockResolvedValue(null),
    deriveScenePath: jest.fn((p: string) => `${p.replace(/(\.[a-zA-Z0-9]+)+$/, '')}.scene.json`),
  },
}));

const mockAutoSaveV2 = DxfFirestoreService.autoSaveV2 as jest.Mock;
const mockGetFileFloorScope = DxfFirestoreService.getFileFloorScope as jest.Mock;

const BLANK = { id: 'lvl_blank', name: '3ος Όροφος', floorId: 'flr_3' };
const BIRTH = resolveLevelDrawingBirthTarget(BLANK, 'co1')!;

const sceneWith = (n: number): SceneModel =>
  ({ entities: Array.from({ length: n }, (_, i) => ({ id: `e${i}`, type: 'line' })) }) as unknown as SceneModel;

async function flushDebouncedSave() {
  await act(async () => {
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useAutoSaveSceneManager — στόχος γέννησης (ADR-913)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAutoSaveV2.mockClear();
    mockGetFileFloorScope.mockReset();
    mockGetFileFloorScope.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ΤΟ ΠΡΟΒΛΗΜΑ: χωρίς στόχο, μια γραμμή σε κενό επίπεδο δεν αποθηκεύεται ποτέ', async () => {
    const { result } = renderHook(() => useAutoSaveSceneManager());

    act(() => { result.current.setLevelScene(BLANK.id, sceneWith(1), 'local-edit'); });
    await flushDebouncedSave();

    expect(mockAutoSaveV2).not.toHaveBeenCalled();
  });

  it('Η ΛΥΣΗ: με ανοιχτό στόχο γέννησης η ίδια γραμμή γράφεται στο αρχείο ΤΟΥ επιπέδου', async () => {
    const { result } = renderHook(() => useAutoSaveSceneManager());

    act(() => { openFileLessLevelTarget(result.current, BLANK, 'co1'); });
    act(() => { result.current.setLevelScene(BLANK.id, sceneWith(1), 'local-edit'); });
    await flushDebouncedSave();

    expect(mockAutoSaveV2).toHaveBeenCalledTimes(1);
    const [fileId, fileName, , ctx] = mockAutoSaveV2.mock.calls[0];
    expect(fileId).toBe(BIRTH.fileId);
    expect(fileName).toBe('3ος Όροφος.dxf');
    expect(ctx.canonicalScenePath).toBe(BIRTH.saveContext.canonicalScenePath);
    expect(ctx).toMatchObject({ entityType: 'floor', floorId: 'flr_3', filesCategory: 'floorplans' });
    // Δεν κρίθηκε ορφανό, άρα και η επόμενη επεξεργασία αποθηκεύεται.
    expect(result.current.isFileTargetOrphaned(BIRTH.fileId)).toBe(false);
  });

  it('κενή σκηνή δεν γεννά ποτέ αρχείο (ο φρουρός «ποτέ κενή σκηνή» μένει)', async () => {
    const { result } = renderHook(() => useAutoSaveSceneManager());

    act(() => { openFileLessLevelTarget(result.current, BLANK, 'co1'); });
    act(() => { result.current.setLevelScene(BLANK.id, sceneWith(0), 'local-edit'); });
    await flushDebouncedSave();

    expect(mockAutoSaveV2).not.toHaveBeenCalled();
  });

  it('το ticket γέννησης κουβαλά το ΔΙΚΟ του context, ακόμη κι αν το ambient αντικατασταθεί', async () => {
    const { result } = renderHook(() => useAutoSaveSceneManager());

    act(() => { openFileLessLevelTarget(result.current, BLANK, 'co1'); });
    // Εισαγωγή χωρίς δικό της FileRecord αντικαθιστά το ambient context (useSceneState).
    act(() => { result.current.setSaveContext({ floorId: 'flr_other', filesCategory: 'drawings' }); });
    act(() => { result.current.setLevelScene(BLANK.id, sceneWith(2), 'local-edit'); });
    await flushDebouncedSave();

    const [fileId, , , ctx] = mockAutoSaveV2.mock.calls[0];
    expect(fileId).toBe(BIRTH.fileId);
    expect(ctx.canonicalScenePath).toBe(BIRTH.saveContext.canonicalScenePath);
    expect(ctx.floorId).toBe('flr_3');
  });

  it('ΚΟΛΛΗΜΕΝΟ CONTEXT: το context του επιπέδου Β δεν ταξιδεύει με το αρχείο του Α', async () => {
    const FILE_A = 'file_A';
    const PATH_A = 'companies/co1/entities/floor/flr_A/domains/construction/categories/floorplans/files/file_A.dxf';
    mockGetFileFloorScope.mockResolvedValue({ storagePath: PATH_A, entityType: 'floor', entityId: 'flr_A' });
    const { result } = renderHook(() => useAutoSaveSceneManager());

    // Ο χρήστης ήταν στο κενό επίπεδο (στόχος γέννησης ανοιχτός)…
    act(() => { openFileLessLevelTarget(result.current, BLANK, 'co1'); });
    // …και γυρίζει στο Α από τη ΓΡΗΓΟΡΗ διαδρομή του loader: fileId + όνομα, ΟΧΙ context.
    act(() => {
      result.current.setLevelFloorScope('lvl_A', 'flr_A');
      result.current.setFileRecordId(FILE_A);
      result.current.setCurrentFileName('Α.dxf');
    });
    act(() => { result.current.setLevelScene('lvl_A', sceneWith(3), 'local-edit'); });
    await flushDebouncedSave();

    expect(mockAutoSaveV2).toHaveBeenCalledTimes(1);
    const [fileId, , , ctx] = mockAutoSaveV2.mock.calls[0];
    expect(fileId).toBe(FILE_A);
    // Το path λύθηκε από το FileRecord του Α — ΟΧΙ από το κολλημένο context του κενού επιπέδου.
    expect(ctx.canonicalScenePath).toBe(PATH_A.replace(/\.dxf$/, '.scene.json'));
    expect(ctx.canonicalScenePath).not.toBe(BIRTH.saveContext.canonicalScenePath);
    expect(ctx.filesCategory).toBeUndefined();
  });
});
