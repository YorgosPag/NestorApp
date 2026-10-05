/**
 * 🔗 Η ΑΓΚΥΡΑ ΤΗΣ ΕΠΙΛΟΓΗΣ ΑΡΧΕΙΟΥ ΣΤΗ ΔΙΕΥΘΥΝΣΗ (ADR-899 §9 θέμα 10, 2026-10-05).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Σ1: η επιλογή ξαναγίνεται τοπική κατάσταση ⇒ η διεύθυνση δεν ανοίγει αρχείο, και το κλικ δεν τη γράφει.
 * - Σ2: η απόφαση διαβάζει τη ΦΙΛΤΡΑΡΙΣΜΕΝΗ λίστα ⇒ ένα φίλτρο «σβήνει» το αρχείο που ζήτησε η διεύθυνση.
 * - Σ3: η εφεδρεία δεν ρωτιέται (ή ρωτιέται πριν απαντήσει η λίστα) ⇒ εισερχόμενο = «δεν βρέθηκε».
 * - Σ4: το καρέ πριν ξεκινήσει η εφεδρεία ανακοινώνει «δεν βρέθηκε».
 * - Σ5: το πάνελ κρατά αντίγραφο της εγγραφής αντί για τη ζωντανή.
 */

import { act, renderHook } from '@testing-library/react';

import type { FileRecord } from '@/types/file-record';

import { useFileViewerSelection, type FileViewerSelectionParams } from '../useFileViewerSelection';

const getFileRecord = jest.fn<Promise<FileRecord | null>, [string]>();
jest.mock('@/services/file-record.service', () => ({
  FileRecordService: { getFileRecord: (id: string) => getFileRecord(id) },
}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const MINE = 'comp_mine';
const record = (id: string, over: Partial<FileRecord> = {}): FileRecord => ({
  id, companyId: MINE, status: 'ready', domain: 'construction', lifecycleState: 'active', isDeleted: false, ...over,
} as FileRecord);

const A = record('file_a');
const B = record('file_b');
const params = (over: Partial<FileViewerSelectionParams> = {}): FileViewerSelectionParams => ({
  companyId: MINE, files: [A, B], trashedFiles: [], visibleFiles: [A, B], hasAnswered: true, ...over,
});

const startAt = (url: string) => window.history.replaceState(null, '', url);
/** Η ειδοποίηση του `url-query-state` φεύγει σε microtask — βλ. `useSelectedEntityUrlState.test`. */
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('useFileViewerSelection', () => {
  beforeEach(() => {
    startAt('/files');
    getFileRecord.mockReset();
  });

  test('🔴 Σ1 η διεύθυνση ανοίγει το αρχείο· χωρίς παράμετρο ⇒ καμία επιλογή', () => {
    const bare = renderHook(() => useFileViewerSelection(params()));
    expect(bare.result.current.viewerOutcome).toEqual({ kind: 'none' });
    bare.unmount();
    startAt('/files?file=file_b');
    const { result } = renderHook(() => useFileViewerSelection(params()));
    expect(result.current.selectedFile).toBe(B);
    expect(getFileRecord).not.toHaveBeenCalled();
  });

  test('🔴 Σ1 το κλικ ΓΡΑΦΕΙ τη διεύθυνση και το κλείσιμο τη ΣΒΗΝΕΙ', async () => {
    const { result } = renderHook(() => useFileViewerSelection(params()));
    act(() => result.current.setSelectedFile(A));
    await flush();
    expect(window.location.search).toBe('?file=file_a');
    expect(result.current.selectedFile).toBe(A);
    act(() => result.current.setSelectedFile(null));
    await flush();
    expect(window.location.search).toBe('');
    expect(result.current.viewerOutcome).toEqual({ kind: 'none' });
  });

  test('🔴 Σ2 το φίλτρο κρύβει το αρχείο από τη λίστα ⇒ δείχνεται, με ένδειξη', () => {
    startAt('/files?file=file_b');
    const { result } = renderHook(() => useFileViewerSelection(params({ visibleFiles: [A] })));
    expect(result.current.viewerOutcome).toEqual({ kind: 'shown', file: B, hiddenByFilters: true });
    expect(result.current.selectedFile).toBe(B);
  });

  test('🔴 Σ5 η λίστα ανανεώνεται ⇒ το πάνελ παίρνει τη ΖΩΝΤΑΝΗ εγγραφή, όχι αντίγραφο', () => {
    startAt('/files?file=file_a');
    const { result, rerender } = renderHook((p: FileViewerSelectionParams) => useFileViewerSelection(p), { initialProps: params() });
    const fresh = record('file_a', { displayName: 'νέο όνομα' });
    rerender(params({ files: [fresh, B], visibleFiles: [fresh, B] }));
    expect(result.current.selectedFile).toBe(fresh);
  });

  test('στον Κάδο ⇒ trashed, καμία προβολή, καμία ερώτηση στην εφεδρεία', () => {
    startAt('/files?file=file_t');
    const { result } = renderHook(() => useFileViewerSelection(params({ trashedFiles: [record('file_t', { isDeleted: true })] })));
    expect(result.current.viewerOutcome).toEqual({ kind: 'trashed' });
    expect(result.current.selectedFile).toBeNull();
    expect(getFileRecord).not.toHaveBeenCalled();
  });

  test('🔴 Σ3 η λίστα δεν απάντησε ⇒ resolving, και η εφεδρεία ΔΕΝ ρωτιέται ακόμη', () => {
    startAt('/files?file=file_x');
    const { result } = renderHook(() => useFileViewerSelection(params({ files: [], visibleFiles: [], hasAnswered: false })));
    expect(result.current.viewerOutcome).toEqual({ kind: 'resolving' });
    expect(getFileRecord).not.toHaveBeenCalled();
  });

  test('🔴 Σ3+Σ4 εκτός λίστας ⇒ resolving από το ΠΡΩΤΟ καρέ, μετά η απάντηση της εφεδρείας (εισερχόμενο)', async () => {
    const inbox = record('file_in', { status: 'pending', domain: 'ingestion' } as Partial<FileRecord>);
    getFileRecord.mockResolvedValue(inbox);
    startAt('/files?file=file_in');
    const kinds: string[] = [];
    const { result } = renderHook(() => {
      const selection = useFileViewerSelection(params());
      kinds.push(selection.viewerOutcome.kind);
      return selection;
    });
    expect(kinds[0]).toBe('resolving');
    await flush();
    expect(getFileRecord).toHaveBeenCalledWith('file_in');
    expect(result.current.viewerOutcome).toEqual({ kind: 'inbox', file: inbox });
    expect(kinds).not.toContain('not-found');
  });

  test('ανύπαρκτο · άρνηση ανάγνωσης · ξένος χώρος ⇒ το ΙΔΙΟ not-found', async () => {
    startAt('/files?file=file_none');
    getFileRecord.mockResolvedValueOnce(null);
    const missing = renderHook(() => useFileViewerSelection(params()));
    await flush();
    expect(missing.result.current.viewerOutcome).toEqual({ kind: 'not-found' });
    missing.unmount();

    getFileRecord.mockRejectedValueOnce(new Error('permission-denied'));
    const denied = renderHook(() => useFileViewerSelection(params()));
    await flush();
    expect(denied.result.current.viewerOutcome).toEqual({ kind: 'not-found' });
    denied.unmount();

    getFileRecord.mockResolvedValueOnce(record('file_none', { companyId: 'comp_other' }));
    const foreign = renderHook(() => useFileViewerSelection(params()));
    await flush();
    expect(foreign.result.current.viewerOutcome).toEqual({ kind: 'not-found' });
  });
});
