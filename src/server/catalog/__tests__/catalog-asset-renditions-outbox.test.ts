/**
 * @jest-environment node
 *
 * Η απόδοση σημειώνει τη βιτρίνα (ADR-923 §5.13 Σ3): το έγγραφο αρχείου δεν περνά από το `noteWrite`, άρα χωρίς αυτή τη σημείωση
 * το μέσο θα έμενε εκτός δημόσιου εγγράφου ως το επόμενο πλήρες πέρασμα.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { CATALOG_RENDITION_RECIPE_VERSION } from '@/subapps/catalog/renditions/catalog-renditions';
import { ensureCatalogAssetRenditions, type CatalogRenditionTarget } from '../catalog-asset-renditions.server';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/storage/storage-object-stream', () => ({
  statStorageObject: async () => ({ kind: 'found', generation: '1', contentType: 'image/jpeg', size: 1, dimensions: null }),
  readStorageObjectGeneration: async () => new Uint8Array([0, 1, 2]),
}));
jest.mock('@/server/files/file-record-bucket', () => ({
  fileRecordBucket: () => ({ file: () => ({ save: async () => undefined }) }),
}));

const FILE = 'file_1';
const OUTBOX = 'catalog_public_outbox';

let fake: FakeFirestore;
let db: Firestore;

const target = (over: Partial<CatalogRenditionTarget['record']> = {}, custody: CatalogRenditionTarget['custody'] = 'company'): CatalogRenditionTarget =>
  ({ custody, fileId: FILE, record: { storagePath: 'c/1.jpg', ...over } });

beforeEach(async () => {
  fake = new FakeFirestore();
  db = fake as unknown as Firestore;
  await db.collection('files').doc(FILE).set({ id: FILE });
});

describe('recordRenditions', () => {
  it('αρχείο εταιρείας: καταγραφή και σημείωση catalog μαζί', async () => {
    await ensureCatalogAssetRenditions(db, target({ companyId: 'comp-a' }));
    expect(fake.getAllDocs('files')[FILE].catalogRenditions).toMatchObject({ recipe: CATALOG_RENDITION_RECIPE_VERSION });
    expect(Object.values(fake.getAllDocs(OUTBOX))).toEqual([expect.objectContaining({ companyId: 'comp-a', scope: 'catalog', revision: 1, dirty: true })]);
  });

  it('χωρίς χώρο στην εγγραφή: καταγράφει και δεν σημειώνει τίποτα', async () => {
    await ensureCatalogAssetRenditions(db, target());
    expect(fake.getAllDocs('files')[FILE].catalogRenditions).toBeDefined();
    expect(fake.getAllDocs(OUTBOX)).toEqual({});
  });
});
