/**
 * Η **σύνδεση αρχείου ↔ μέσου** (ADR-923 §5.10.3 · Φάση 2γ) πάνω στο επαληθευμένο ψεύτικο Firestore: γραφέας
 * (`attachCatalogAssetFile` · επανέλεγχος είδους στο `updateCatalogAsset`) και ενορχηστρωτής (μέτρηση → αποδόσεις →
 * συναλλαγή), με **ανταγωνιστή** ανάμεσα σε ανάγνωση και commit.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Σ1: ξένο αρχείο (άλλο μέσο/εταιρεία) δένεται · μέσο άλλου χώρου αλλάζει.
 * - Σ2: ιδεμποτία — ίδιο `fileId` ανεβάζει αναθεώρηση ή γράφει ίχνος.
 * - Σ3: το αρχείο κρίνεται από στιγμιότυπο ΠΡΙΝ τη συναλλαγή — πετιέται στον κάδο και δένεται παρ' όλα αυτά.
 * - Σ4: αλλαγή είδους με συνδεδεμένο αρχείο αφήνει φωτογραφία μέσα σε μέσο «έγγραφο».
 * - Σ5: ο ενορχηστρωτής κατεβάζει/κωδικοποιεί για ξένο αρχείο · περνά στη συναλλαγή τη ΔΗΛΩΣΗ μεγέθους αντί για τη μέτρηση.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { CATALOG_RENDITION_RECIPE_VERSION } from '@/subapps/catalog/renditions/catalog-renditions';
import { ARIES, RIVAL, SEED_RIGHTS, rejectionOf } from './catalog-writer-seed';

const fake = new FakeFirestore();
const recordTrackedEntityWrite = jest.fn(async (_input: { entityType: string; entityId: string; before: unknown; after: unknown }) => undefined);
const mockStat = jest.fn();
const mockEnsure = jest.fn();

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));
jest.mock('@/services/entity-audit-tracked-write', () => ({
  recordTrackedEntityWrite: (input: { entityType: string; entityId: string; before: unknown; after: unknown }) => recordTrackedEntityWrite(input),
}));
jest.mock('@/lib/storage/storage-object-stream', () => ({ statStorageObject: (...args: unknown[]) => mockStat(...args) }));
jest.mock('@/server/files/file-record-bucket', () => ({ fileRecordBucket: () => ({ name: 'files-bucket' }) }));
jest.mock('../catalog-asset-renditions.server', () => ({ ensureCatalogAssetRenditions: (...args: unknown[]) => mockEnsure(...args) }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι γραφείς */
import { attachCatalogAssetFile, createCatalogAsset, updateCatalogAsset } from '../asset-writer.server';
import { attachFileToCatalogAsset } from '../asset-file-attach.server';
/* eslint-enable import/first */

const READY = { status: 'ready', recipe: CATALOG_RENDITION_RECIPE_VERSION, sourceGeneration: '1' };
const MEASURED = { storedSizeBytes: 4_000_000 };

function seedFile(id: string, assetId: string, extra: Record<string, unknown> = {}): void {
  fake.seed('files', id, {
    companyId: ARIES.companyId,
    entityType: 'catalog_asset',
    entityId: assetId,
    status: 'ready',
    storagePath: `companies/${ARIES.companyId}/entities/catalog_asset/${assetId}/domains/catalog/categories/photos/files/${id}.jpg`,
    ext: 'jpg',
    contentType: 'image/jpeg',
    sizeBytes: 4_000_000,
    catalogRenditions: READY,
    ...extra,
  });
}

async function photoAsset() {
  return createCatalogAsset(ARIES, { code: 'mfp_hero', role: 'drawing', kind: 'image', labels: { el: 'MFP' }, description: {}, rights: SEED_RIGHTS });
}

const asset = (id: string) => fake.getData('catalog_assets', id) as { fileId: string | null; revision: number; kind: string };

beforeEach(() => {
  fake.reset();
  recordTrackedEntityWrite.mockClear();
  mockStat.mockReset();
  mockEnsure.mockReset();
  fake.interfere = null;
});

describe('attachCatalogAssetFile — ο γραφέας', () => {
  it('✅ δένει το αρχείο: `fileId`, αναθεώρηση +1, ίχνος ιστορικού', async () => {
    const created = await photoAsset();
    seedFile('file_1', created.id);
    const attached = await attachCatalogAssetFile(ARIES, created.id, 1, 'file_1', MEASURED);
    expect(attached).toMatchObject({ fileId: 'file_1', revision: 2 });
    expect(asset(created.id)).toMatchObject({ fileId: 'file_1', revision: 2 });
    expect(recordTrackedEntityWrite).toHaveBeenLastCalledWith(
      expect.objectContaining({ entityType: 'catalog_asset', entityId: created.id, after: expect.objectContaining({ fileId: 'file_1' }) }),
    );
  });

  it('🔴 Σ2 ίδιο `fileId` ⇒ καμία αναθεώρηση, κανένα ίχνος (ακόμη και με παλιό expectedRevision)', async () => {
    const created = await photoAsset();
    seedFile('file_1', created.id);
    await attachCatalogAssetFile(ARIES, created.id, 1, 'file_1', MEASURED);
    recordTrackedEntityWrite.mockClear();
    expect(await attachCatalogAssetFile(ARIES, created.id, 1, 'file_1', MEASURED)).toMatchObject({ revision: 2 });
    expect(recordTrackedEntityWrite).not.toHaveBeenCalled();
  });

  it('νέα έκδοση = νέο `FileRecord` στο ίδιο μέσο · παλιό expectedRevision ⇒ 409', async () => {
    const created = await photoAsset();
    seedFile('file_1', created.id);
    seedFile('file_2', created.id);
    await attachCatalogAssetFile(ARIES, created.id, 1, 'file_1', MEASURED);
    expect((await rejectionOf(attachCatalogAssetFile(ARIES, created.id, 1, 'file_2', MEASURED))).kind).toBe('revisionMismatch');
    expect(await attachCatalogAssetFile(ARIES, created.id, 2, 'file_2', MEASURED)).toMatchObject({ fileId: 'file_2', revision: 3 });
  });

  it('🔴 Σ1 αρχείο άλλου μέσου ⇒ 422 fileForeignOwner · μέσο άλλου χώρου ⇒ notFound', async () => {
    const created = await photoAsset();
    seedFile('file_x', 'casst_other');
    const refused = await rejectionOf(attachCatalogAssetFile(ARIES, created.id, 1, 'file_x', MEASURED));
    expect(refused.kind).toBe('invalid');
    expect(refused.issues.map((i) => i.code)).toEqual(['fileForeignOwner']);
    expect(asset(created.id).fileId).toBeNull();
    seedFile('file_1', created.id);
    expect((await rejectionOf(attachCatalogAssetFile(RIVAL, created.id, 1, 'file_1', MEASURED))).kind).toBe('notFound');
  });

  // Ο ανταγωνιστής του fake χτυπά μετά την ΠΡΩΤΗ ανάγνωση της συναλλαγής (το μέσο): το αρχείο πρέπει να διαβάζεται
  // ΜΕΣΑ στη συναλλαγή — ένα στιγμιότυπο του πριν θα έδενε αρχείο που ήδη πετάχτηκε.
  it('🔴 Σ3 ανταγωνιστής: το αρχείο πετιέται στον κάδο αφού ξεκίνησε η συναλλαγή ⇒ δεν δένεται', async () => {
    const created = await photoAsset();
    seedFile('file_1', created.id);
    fake.interfere = () => {
      fake.write('files', 'file_1', { ...fake.getData('files', 'file_1'), isDeleted: true });
      fake.interfere = null;
    };
    const refused = await rejectionOf(attachCatalogAssetFile(ARIES, created.id, 1, 'file_1', MEASURED));
    expect(refused.issues.map((i) => i.code)).toEqual(['fileNotFound']);
    expect(asset(created.id).fileId).toBeNull();
  });

  it('εικόνα χωρίς αποδόσεις ⇒ 422 renditionsNotReady', async () => {
    const created = await photoAsset();
    seedFile('file_1', created.id, { catalogRenditions: undefined });
    const refused = await rejectionOf(attachCatalogAssetFile(ARIES, created.id, 1, 'file_1', MEASURED));
    expect(refused.issues.map((i) => i.code)).toEqual(['renditionsNotReady']);
  });
});

describe('updateCatalogAsset — αλλαγή είδους με συνδεδεμένο αρχείο', () => {
  it('🔴 Σ4 φωτογραφία συνδεδεμένη ⇒ το μέσο ΔΕΝ γίνεται «έγγραφο» · χωρίς αρχείο, γίνεται', async () => {
    const created = await photoAsset();
    seedFile('file_1', created.id);
    await attachCatalogAssetFile(ARIES, created.id, 1, 'file_1', MEASURED);
    const input = { code: 'mfp_hero', role: 'drawing' as const, kind: 'document' as const, labels: { el: 'MFP' }, description: {}, rights: SEED_RIGHTS };
    const refused = await rejectionOf(updateCatalogAsset(ARIES, created.id, 2, input));
    expect(refused.issues).toEqual([{ code: 'fileKindMismatch', path: 'kind', params: { kind: 'document' } }]);

    const empty = await createCatalogAsset(ARIES, { ...input, code: 'mfp_sheet', kind: 'image' });
    expect(await updateCatalogAsset(ARIES, empty.id, 1, { ...input, code: 'mfp_sheet' })).toMatchObject({ kind: 'document' });
  });
});

describe('attachFileToCatalogAsset — ο ενορχηστρωτής', () => {
  it('🔴 Σ5 εικόνα του μέσου ⇒ μέτρηση από τον κάδο → αποδόσεις → συναλλαγή με το ΜΕΤΡΗΜΕΝΟ μέγεθος', async () => {
    const created = await photoAsset();
    seedFile('file_1', created.id, { sizeBytes: 10 });
    mockStat.mockResolvedValue({ kind: 'found', generation: '1', contentType: 'image/jpeg', size: 300 * 1024 * 1024, dimensions: null });
    const refused = await rejectionOf(attachFileToCatalogAsset(ARIES, created.id, { expectedRevision: 1, fileId: 'file_1' }));
    expect(mockEnsure).toHaveBeenCalledTimes(1);
    expect(mockEnsure.mock.calls[0][1]).toMatchObject({ custody: 'company', fileId: 'file_1' });
    // Η δήλωση έλεγε 10 bytes· ο κάδος 300 MB ⇒ το όριο εικόνας (200 MB) κρίνεται στη μέτρηση.
    expect(refused.issues.map((i) => i.code)).toEqual(['fileTooLarge']);
  });

  it('🔴 Σ5 ξένο αρχείο ⇒ ΚΑΜΙΑ μέτρηση, ΚΑΜΙΑ κωδικοποίηση — η απόφαση μένει στη συναλλαγή', async () => {
    const created = await photoAsset();
    seedFile('file_x', 'casst_other');
    const refused = await rejectionOf(attachFileToCatalogAsset(ARIES, created.id, { expectedRevision: 1, fileId: 'file_x' }));
    expect(refused.issues.map((i) => i.code)).toEqual(['fileForeignOwner']);
    expect(mockStat).not.toHaveBeenCalled();
    expect(mockEnsure).not.toHaveBeenCalled();
  });

  it('PDF ⇒ μέτρηση ναι, αποδόσεις όχι', async () => {
    const created = await createCatalogAsset(ARIES, { code: 'mfp_sheet', role: 'datasheet', kind: 'document', labels: { el: 'MFP' }, description: {}, rights: SEED_RIGHTS });
    seedFile('file_pdf', created.id, { ext: 'pdf', contentType: 'application/pdf', catalogRenditions: undefined });
    mockStat.mockResolvedValue({ kind: 'found', generation: '1', contentType: 'application/pdf', size: 2_000_000, dimensions: null });
    const attached = await attachFileToCatalogAsset(ARIES, created.id, { expectedRevision: 1, fileId: 'file_pdf' });
    expect(attached).toMatchObject({ fileId: 'file_pdf' });
    expect(mockStat).toHaveBeenCalledTimes(1);
    expect(mockEnsure).not.toHaveBeenCalled();
  });
});
