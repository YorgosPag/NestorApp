/**
 * Α40.2 / Α40.3 — ADR-866 §2.10.9: το `useFloorplanAutoProcess` ζητά επεξεργασία **μόνο** γι' αυτό που ο
 * διακομιστής μπορεί να κάνει, και **δεν χάνει** αρχεία όταν ακυρωθεί στη μέση.
 *
 * Μετρημένο ζωντανά 2026-09-22 (φάκελος δοκιμής, καρτέλα Τοπογραφικό):
 * · `POST /api/floorplans/process` ×3 για PNG **προσωπικού** φακέλου ⇒ `404 File not found` (Α40.2).
 * · το **νέο** τοπογραφικό **δεν στάλθηκε ποτέ**: η λίστα άλλαξε όσο έτρεχε το πρώτο αίτημα, ο βρόχος
 *   σταμάτησε, και το δεύτερο έμεινε σημαδεμένο «σταλμένο» (Α40.3).
 *
 * Όρια που κόβονται: η πύλη μετάλλαξης (δίκτυο) · ειδοποιήσεις · telemetry. Το κατηγόρημα τρέχει **αληθινό**.
 */

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
const NOTIFICATIONS = { importedWithWarnings: jest.fn() };
jest.mock('@/hooks/notifications/useDxfImportNotifications', () => ({
  useDxfImportNotifications: () => NOTIFICATIONS,
}));
jest.mock('@/services/floorplans/floorplan-processing-mutation-gateway', () => ({
  processFloorplanWithPolicy: jest.fn(),
  isInProgress: () => false,
}));

import { act, renderHook, waitFor } from '@testing-library/react';
import { processFloorplanWithPolicy } from '@/services/floorplans/floorplan-processing-mutation-gateway';
import type { FileRecord } from '@/types/file-record';
import { useFloorplanAutoProcess } from '../useFloorplanAutoProcess';

const processMock = processFloorplanWithPolicy as jest.MockedFunction<typeof processFloorplanWithPolicy>;

function file(id: string, ext: string, owner: { companyId: string } | { userId: string }): FileRecord {
  return { id, ext, status: 'ready', downloadUrl: `https://x/${id}`, ...owner } as FileRecord;
}

const sentIds = () => processMock.mock.calls.map(([arg]) => arg.fileId);

beforeEach(() => {
  processMock.mockReset();
  processMock.mockResolvedValue({ success: true, fileId: 'x' } as Awaited<ReturnType<typeof processFloorplanWithPolicy>>);
});

describe('Α40.2 — μόνο ό,τι ο διακομιστής μπορεί να επεξεργαστεί', () => {
  it('🔴 PNG προσωπικού φακέλου (η ζωντανή περίπτωση) · εταιρικό PNG · προσωπικό DXF ⇒ ΚΑΝΕΝΑ αίτημα', async () => {
    const files = [
      file('f_personal_png', 'png', { userId: 'uid_1' }),
      file('f_company_png', 'png', { companyId: 'comp_1' }),
      file('f_personal_dxf', 'dxf', { userId: 'uid_1' }),
    ];
    renderHook(() => useFloorplanAutoProcess({ displayStyle: 'floorplan-gallery', files, refetch: jest.fn() }));
    await act(async () => { await Promise.resolve(); });
    expect(processMock).not.toHaveBeenCalled();
  });

  it('εταιρικό DXF ⇒ ένα αίτημα', async () => {
    const files = [file('f_company_dxf', 'dxf', { companyId: 'comp_1' })];
    renderHook(() => useFloorplanAutoProcess({ displayStyle: 'floorplan-gallery', files, refetch: jest.fn() }));
    await waitFor(() => expect(sentIds()).toEqual(['f_company_dxf']));
  });
});

describe('Α40.3 — ακύρωση στη μέση ΔΕΝ χάνει αρχεία', () => {
  it('το δεύτερο αρχείο στέλνεται στην επόμενη αλλαγή της λίστας', async () => {
    let releaseFirst: () => void = () => undefined;
    processMock.mockImplementationOnce(() => new Promise((resolve) => {
      releaseFirst = () => resolve({ success: true, fileId: 'a' } as Awaited<ReturnType<typeof processFloorplanWithPolicy>>);
    }));
    const a = file('f_a', 'dxf', { companyId: 'comp_1' });
    const b = file('f_b', 'dxf', { companyId: 'comp_1' });
    const refetch = jest.fn();
    const { rerender } = renderHook(
      ({ files }) => useFloorplanAutoProcess({ displayStyle: 'floorplan-gallery', files, refetch }),
      { initialProps: { files: [a, b] } },
    );
    await waitFor(() => expect(sentIds()).toEqual(['f_a']));

    rerender({ files: [a, b] }); // ο ακροατής έφερε νέα όψη όσο έτρεχε το f_a ⇒ ακύρωση
    await act(async () => { releaseFirst(); await Promise.resolve(); });

    rerender({ files: [a, b] }); // επόμενη όψη
    await waitFor(() => expect(sentIds()).toEqual(['f_a', 'f_b']));
  });
});
