/**
 * 🔗 Η ΑΓΚΥΡΑ ΤΗΣ ΑΝΤΙΣΤΟΙΧΙΣΗΣ «ΑΡΧΕΙΟ ΣΚΗΝΗΣ → ΕΠΙΠΕΔΟ» (ADR-400, 2026-10-08).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Α1: το επίπεδο βρίσκεται από άλλο πεδίο (π.χ. `floorId`) ⇒ το κουμπί ανοίγει ξένη κάτοψη.
 * - Α2: ο ανώνυμος επισκέπτης δημόσιας σελίδας ρωτά τον διακομιστή ⇒ 401 σε κάθε δημόσια κάτοψη.
 * - Α3: η άρνηση (403) γίνεται σφάλμα αντί για «κανένα κουμπί».
 * - Α4: κάθε αλλαγή κάτοψης ξαναρωτά τον διακομιστή.
 * - Α5: άλλος χρήστης κληρονομεί τη λίστα του προηγούμενου.
 */

import { renderHook, waitFor } from '@testing-library/react';

import { useSceneFileLevelId } from '../useSceneFileLevelId';

const mockGet = jest.fn();
let mockUid: string | null = 'user-1';

jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { get: (...args: unknown[]) => mockGet(...args) } }));
jest.mock('@/auth/contexts/AuthContext', () => ({
  useAuthOptional: () => (mockUid === null ? null : { user: { uid: mockUid } }),
}));

const LEVELS = {
  success: true,
  levels: [
    { id: 'lvl_active', sceneFileId: 'file_active', floorId: 'flr_other' },
    { id: 'lvl_duplicate', sceneFileId: 'file_active', floorId: 'flr_x' },
    { id: 'lvl_empty', sceneFileId: null, floorId: 'file_active' },
  ],
  stats: { totalLevels: 3 },
};

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockResolvedValue(LEVELS);
});

describe('useSceneFileLevelId', () => {
  test('🔴 Α1 το επίπεδο βρίσκεται από το `sceneFileId` — και το πρώτο κατά σειρά κερδίζει', async () => {
    mockUid = 'user-a1';
    const { result } = renderHook(() => useSceneFileLevelId('file_active'));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe('lvl_active'));
  });

  test('🔴 Α2 ανώνυμος επισκέπτης ή κάτοψη που δεν είναι σχέδιο ⇒ καμία κλήση', () => {
    mockUid = null;
    expect(renderHook(() => useSceneFileLevelId('file_active')).result.current).toBeNull();
    mockUid = 'user-a2';
    expect(renderHook(() => useSceneFileLevelId(null)).result.current).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  test('🔴 Α3 άρνηση του διακομιστή ⇒ `null`, ποτέ σφάλμα', async () => {
    mockUid = 'user-a3';
    mockGet.mockRejectedValue(new Error('403'));
    const { result } = renderHook(() => useSceneFileLevelId('file_active'));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
    expect(result.current).toBeNull();
  });

  test('🔴 Α4 αλλαγή κάτοψης ⇒ ΜΙΑ ανάγνωση, και αρχείο χωρίς επίπεδο ⇒ `null`', async () => {
    mockUid = 'user-a4';
    const { result, rerender } = renderHook(({ id }) => useSceneFileLevelId(id), { initialProps: { id: 'file_active' } });
    await waitFor(() => expect(result.current).toBe('lvl_active'));
    rerender({ id: 'file_without_level' });
    expect(result.current).toBeNull();
    rerender({ id: 'file_active' });
    await waitFor(() => expect(result.current).toBe('lvl_active'));
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  test('🔴 Α5 άλλος χρήστης ⇒ νέα ανάγνωση, όχι η λίστα του προηγούμενου', async () => {
    mockUid = 'user-a5-first';
    const first = renderHook(() => useSceneFileLevelId('file_active'));
    await waitFor(() => expect(first.result.current).toBe('lvl_active'));
    mockUid = 'user-a5-second';
    mockGet.mockResolvedValue({ success: true, levels: [], stats: { totalLevels: 0 } });
    const second = renderHook(() => useSceneFileLevelId('file_active'));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(second.result.current).toBeNull();
  });
});
