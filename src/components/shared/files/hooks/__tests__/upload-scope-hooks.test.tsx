/**
 * Α38.1β/γ — ADR-866 §2.10 Β1: τα **hooks** ρωτούν τον ΕΝΑ επιλυτή εμβέλειας — όχι δικό τους αντίγραφο.
 *
 * · Α38.1β `useFileUpload`: ό,τι φτάνει στο `uploadEntityFile` (domain · category · purpose) είναι **ακριβώς** το
 *   `resolveUploadScope(επιλογή, προεπιλογές)` — με `purposeAuthority: 'entry'` κρατιέται ο σκοπός του **τύπου**.
 * · Α38.1γ `useEntityFiles`: με εμβέλειες το ερώτημα **δεν** στενεύει σε domain/category και κρίνει το ΕΝΑ φίλτρο.
 *
 * Όρια που κόβονται: Firebase · υπηρεσία αρχείων · ειδοποιήσεις · i18n. Ο επιλυτής και τα φίλτρα τρέχουν **αληθινά**.
 */

jest.mock('@/lib/firebase', () => ({ __esModule: true, default: { options: { projectId: 'p', storageBucket: 'b' } } }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/notifications/useFilesNotifications', () => ({
  useFilesNotifications: () => ({ upload: { partialSuccess: jest.fn(), allFailed: jest.fn(), generic: jest.fn(), authFailed: jest.fn(), notAuthenticated: jest.fn() } }),
}));
jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { displayName: 'Κάτοχος' } }) }));
jest.mock('@/services/filesystem/file-mutation-gateway', () => ({
  classifyFileWithPolicy: jest.fn(),
  validateCustodyUploadAuth: jest.fn(async () => ({ uid: 'uid_owner', custody: 'personal' })),
  moveFileToTrashWithPolicy: jest.fn(),
  renameFileWithPolicy: jest.fn(),
  updateFileDescriptionWithPolicy: jest.fn(),
}));
jest.mock('@/services/filesystem/upload-entity-file', () => ({
  uploadEntityFile: jest.fn(async () => ({ fileId: 'file_1', displayName: 'Αρχείο' })),
}));
jest.mock('@/services/realtime', () => ({ RealtimeService: { dispatch: jest.fn(), subscribe: jest.fn(() => jest.fn()) } }));
jest.mock('@/services/firestore', () => ({ firestoreQueryService: { subscribe: jest.fn(() => jest.fn()) } }));
jest.mock('@/services/firestore/firestore-query.service', () => ({ firestoreQueryService: { getAll: jest.fn(), getById: jest.fn() } }));
jest.mock('@/services/file-record.service', () => ({
  FileRecordService: { getFilesByEntity: jest.fn(), getLinkedFiles: jest.fn().mockResolvedValue([]), isVisibleInActiveLists: () => true },
}));

import { act, renderHook, waitFor } from '@testing-library/react';
import type { UploadEntryPoint } from '@/config/upload-entry-points';
import { FileRecordService } from '@/services/file-record.service';
import { uploadEntityFile } from '@/services/filesystem/upload-entity-file';
import type { FileRecord } from '@/types/file-record';
import { useEntityFiles } from '../useEntityFiles';
import { useFileUpload } from '../useFileUpload';
import type { FileScope, PurposeAuthority } from '../../utils/upload-scope';

const TITLE_DEED: UploadEntryPoint = {
  id: 'study-admin-title-deed', purpose: 'study-title-deed', domain: 'admin', category: 'documents',
  label: { el: 'Τίτλος Ιδιοκτησίας', en: 'Title Deed' }, order: 0,
};

function renderUpload(purposeAuthority: PurposeAuthority | undefined) {
  return renderHook(() => useFileUpload({
    custody: { userId: 'uid_owner' }, entityType: 'property_dossier', entityId: 'pdos_1',
    domain: 'admin', category: 'documents', purpose: 'dossier-document', purposeAuthority,
    currentUserId: 'uid_owner', selectedEntryPoint: TITLE_DEED, customTitle: '',
    refetch: jest.fn(), recordFileActivity: jest.fn(),
  }));
}

async function uploadedScope(purposeAuthority: PurposeAuthority | undefined) {
  (uploadEntityFile as jest.Mock).mockClear();
  const { result } = renderUpload(purposeAuthority);
  await act(async () => { await result.current.handleUpload([new File(['x'], 'deed.pdf', { type: 'application/pdf' })]); });
  const [[input]] = (uploadEntityFile as jest.Mock).mock.calls as [[{ domain: string; category: string; purpose?: string }]];
  return { domain: input.domain, category: input.category, purpose: input.purpose };
}

describe('Α38.1β — useFileUpload γράφει ό,τι λέει ο επιλυτής', () => {
  it("purposeAuthority 'entry' ⇒ ο σκοπός του ΤΥΠΟΥ (η ταυτότητα του εγγράφου)", async () => {
    expect(await uploadedScope('entry')).toEqual({ domain: 'admin', category: 'documents', purpose: 'study-title-deed' });
  });

  it('χωρίς δήλωση ⇒ ο ιστορικός κανόνας (σκοπός καρτέλας, όχι μετα-σκοπός) — καμία αλλαγή για τους υπόλοιπους', async () => {
    expect(await uploadedScope(undefined)).toEqual({ domain: 'admin', category: 'documents', purpose: 'dossier-document' });
  });
});

function fileWith(id: string, scope: FileScope): FileRecord {
  return { id, domain: scope.domain, category: scope.category, purpose: scope.purpose } as FileRecord;
}

describe('Α38.1γ — useEntityFiles διαβάζει με τις εμβέλειες', () => {
  const DEED: FileScope = { domain: 'admin', category: 'documents', purpose: 'study-title-deed' };
  const TOPO: FileScope = { domain: 'admin', category: 'documents', purpose: 'study-topographic' };

  it('ερώτημα χωρίς domain/category · κρατά ΜΟΝΟ ό,τι ανήκει στις εμβέλειες', async () => {
    const getFiles = FileRecordService.getFilesByEntity as jest.Mock;
    getFiles.mockResolvedValue([fileWith('f_deed', DEED), fileWith('f_topo', TOPO)]);
    const { result } = renderHook(() => useEntityFiles({
      entityType: 'property_dossier', entityId: 'pdos_1', custody: { userId: 'uid_owner' },
      domain: 'admin', category: 'documents', purpose: 'dossier-document', scopes: [DEED],
    }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const [, , options] = getFiles.mock.calls[getFiles.mock.calls.length - 1] as [string, string, { domain?: string; category?: string }];
    expect({ domain: options.domain, category: options.category }).toEqual({ domain: undefined, category: undefined });
    expect(result.current.files.map((file) => file.id)).toEqual(['f_deed']);
  });
});
