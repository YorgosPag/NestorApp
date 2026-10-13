/**
 * ADR-914 §2.20 — ο αγωγός ανεβάσματος (ADR-292) γράφει το `levelFloorId` στο ΕΚΚΡΕΜΕΣ FileRecord.
 *
 * Ο δίδυμος αγωγός (`uploadEntityFile`, καρτέλα αρχείων) το έγραφε ήδη· αυτός όχι — η
 * `UploadFileConfig` δεν είχε το πεδίο. Η ίδια κάτοψη έπαιρνε ή έχανε τον όροφό της ανάλογα με
 * το ποια οθόνη την ανέβασε.
 */

import { uploadFileWithPolicy, type UploadFileConfig } from '../upload-orchestrator-gateway';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';

const createPendingSpy = jest.fn();
jest.mock('@/services/filesystem/file-mutation-gateway', () => ({
  validateUploadAuth: jest.fn().mockResolvedValue({ uid: 'usr_test' }),
  createPendingFileRecordWithPolicy: (...args: unknown[]) => createPendingSpy(...args),
  finalizeFileRecordWithPolicy: jest.fn().mockResolvedValue(undefined),
  markFileRecordFailedWithPolicy: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(() => ({})),
  uploadBytes: jest.fn().mockResolvedValue(undefined),
  getDownloadURL: jest.fn().mockResolvedValue('https://example.test/file'),
}));

jest.mock('@/lib/firebase', () => ({ storage: {} }));

jest.mock('@/services/upload/utils/resumable-upload', () => ({
  uploadResumableToUrl: jest.fn(),
}));

jest.mock('@/components/shared/files/utils/generate-upload-thumbnail', () => ({
  generateUploadThumbnail: jest.fn(),
  buildThumbnailPath: jest.fn(),
}));

const config: UploadFileConfig = {
  companyId: 'co_test',
  entityType: ENTITY_TYPES.PROPERTY,
  entityId: 'prop_maisonette',
  domain: FILE_DOMAINS.CONSTRUCTION,
  category: FILE_CATEGORIES.FLOORPLANS,
  originalFilename: 'plan.dxf',
  ext: 'dxf',
  contentType: 'application/dxf',
  createdBy: 'usr_test',
  firestoreDelayMs: 0,
};

beforeEach(() => {
  createPendingSpy.mockReset().mockResolvedValue({ fileId: 'file_1', storagePath: 'p/file_1.dxf', fileRecord: { id: 'file_1' } });
});

describe('uploadFileWithPolicy — ο όροφος της όψης', () => {
  it('ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: `levelFloorId` ⇒ γράφεται στη δημιουργία του FileRecord', async () => {
    await uploadFileWithPolicy(new Blob(['0']), { ...config, levelFloorId: 'flr_upper' });

    expect(createPendingSpy).toHaveBeenCalledTimes(1);
    expect(createPendingSpy.mock.calls[0][0]).toMatchObject({ levelFloorId: 'flr_upper' });
  });

  it('χωρίς `levelFloorId` ⇒ το κλειδί δεν υπάρχει καθόλου', async () => {
    await uploadFileWithPolicy(new Blob(['0']), config);

    expect(createPendingSpy.mock.calls[0][0]).not.toHaveProperty('levelFloorId');
  });
});
