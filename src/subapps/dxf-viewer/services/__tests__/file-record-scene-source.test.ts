/**
 * ADR-913 / ADR-714 — «από ποιο μονοπάτι παράγεται η σκηνή;» είναι ΜΙΑ απάντηση για φόρτωση ΚΑΙ εγγραφή.
 *
 * ΤΟ ΣΕΝΑΡΙΟ ΤΗΣ ΖΗΜΙΑΣ (2026-11-15): σχέδιο γεννημένο στον viewer (ADR-913) δεν έχει ποτέ `storagePath` —
 * η διπλή εγγραφή γράφει μόνο `processedData.processedDataPath`. Η φόρτωση έπεφτε σε αυτό· η εγγραφή
 * (`getFileFloorScope`) όχι ⇒ στη νέα συνεδρία ο στόχος κρινόταν «ορφανός» και κάθε αλλαγή χανόταν στο reload.
 * Εδώ κλειδώνεται ότι ΚΑΙ οι δύο πόρτες διαβάζουν το ίδιο SSoT.
 */

const mockGetDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...segments: string[]) => ({ id: segments[segments.length - 1] })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

jest.mock('@/lib/firebase', () => ({ db: { __mockDb: true }, auth: { currentUser: null } }));

jest.mock('../dxf-firestore-storage.impl', () => ({
  saveToStorageImpl: jest.fn(),
  loadFromStorageImpl: jest.fn(),
  validateForSaveImpl: jest.fn(),
  getFileMetadataImpl: jest.fn(),
  getFileImpl: jest.fn(),
}));

import { fileRecordSceneSource, mapFileRecordToDxfMetadata } from '../dxf-firestore.types';
import type { FileRecord } from '@/types/file-record';
import { DxfFirestoreService } from '../dxf-firestore.service';
import { deriveScenePath } from '../dxf-scene-path';

const UPLOADED = 'companies/c/entities/floor/flr_1/domains/construction/categories/floorplans/files/file_up.dxf';
const BORN_SCENE = 'companies/c/entities/floor/flr_1/domains/construction/categories/floorplans/files/file_born.scene.json';

const snapshot = (data: Record<string, unknown> | null) => ({
  exists: () => data !== null,
  data: () => data,
});

describe('fileRecordSceneSource — ο ΕΝΑΣ κανόνας πηγής σκηνής', () => {
  it('το storagePath (ανεβασμένο πρωτότυπο) προηγείται', () => {
    expect(
      fileRecordSceneSource({ storagePath: UPLOADED, processedData: { processedDataPath: BORN_SCENE } }),
    ).toBe(UPLOADED);
  });

  it('χωρίς storagePath ⇒ processedData.processedDataPath (γεννημένο σχέδιο, ADR-913)', () => {
    expect(fileRecordSceneSource({ processedData: { processedDataPath: BORN_SCENE } })).toBe(BORN_SCENE);
  });

  it('κενό storagePath δεν «κερδίζει» — πέφτει στην εφεδρεία', () => {
    expect(fileRecordSceneSource({ storagePath: '', processedData: { processedDataPath: BORN_SCENE } })).toBe(
      BORN_SCENE,
    );
  });

  it.each([
    ['τίποτα', {}],
    ['processedData null', { processedData: null }],
    ['processedData όχι αντικείμενο', { processedData: 'x' }],
    ['χωρίς processedDataPath', { processedData: {} }],
    ['κενό processedDataPath', { processedData: { processedDataPath: '' } }],
    ['μη-string processedDataPath', { processedData: { processedDataPath: 42 } }],
    ['μη-string storagePath, χωρίς εφεδρεία', { storagePath: 7 }],
  ])('%s ⇒ undefined', (_label, record) => {
    expect(fileRecordSceneSource(record)).toBeUndefined();
  });
});

describe('φόρτωση και εγγραφή απαντούν το ΙΔΙΟ', () => {
  beforeEach(() => mockGetDoc.mockReset());

  it('ΤΟ ΣΕΝΑΡΙΟ: γεννημένο αρχείο χωρίς storagePath ⇒ η εγγραφή βρίσκει στόχο (όχι ορφανό)', async () => {
    mockGetDoc.mockResolvedValue(
      snapshot({
        entityType: 'floor',
        entityId: 'flr_1',
        lifecycleState: 'active',
        processedData: { processedDataPath: BORN_SCENE },
      }),
    );

    const scope = await DxfFirestoreService.getFileFloorScope('file_born');

    expect(scope).toEqual({ storagePath: BORN_SCENE, entityType: 'floor', entityId: 'flr_1' });
    // …και ο στόχος εγγραφής είναι ΑΚΡΙΒΩΣ το αρχείο που διαβάζει η φόρτωση.
    expect(deriveScenePath(scope!.storagePath!)).toBe(BORN_SCENE);
  });

  it('η φόρτωση (mapFileRecordToDxfMetadata) και η εγγραφή (getFileFloorScope) δίνουν το ίδιο path', async () => {
    const record = {
      id: 'file_born',
      processedData: { processedDataPath: BORN_SCENE },
      entityType: 'floor',
      entityId: 'flr_1',
    };
    mockGetDoc.mockResolvedValue(snapshot(record));

    const scope = await DxfFirestoreService.getFileFloorScope('file_born');
    const loaded = mapFileRecordToDxfMetadata(record as unknown as FileRecord);

    expect(scope?.storagePath).toBe(loaded.storagePath);
  });

  it('ανεβασμένο DXF: αμετάβλητο — γράφει δίπλα στο πρωτότυπο', async () => {
    mockGetDoc.mockResolvedValue(
      snapshot({ storagePath: UPLOADED, entityType: 'floor', entityId: 'flr_1', processedData: {} }),
    );

    const scope = await DxfFirestoreService.getFileFloorScope('file_up');

    expect(scope?.storagePath).toBe(UPLOADED);
  });

  it('έγγραφο που λείπει ⇒ null (ADR-469: εκεί ΜΟΝΟ είναι ορφανό)', async () => {
    mockGetDoc.mockResolvedValue(snapshot(null));

    await expect(DxfFirestoreService.getFileFloorScope('file_gone')).resolves.toBeNull();
  });
});
