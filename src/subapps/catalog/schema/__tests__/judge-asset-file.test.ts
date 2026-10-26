/**
 * @fileoverview **Ανήκει αυτό το αρχείο σε αυτό το μέσο;** (ADR-923 §5.10.3) — η κρίση πριν γραφτεί `fileId`.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Κ1: αρχείο άλλου μέσου / άλλης εταιρείας / άλλου τύπου οντότητας δένεται (ξένο `fileId`).
 * - Κ2: αρχείο σε ανέβασμα ή στον κάδο δένεται.
 * - Κ3: λάθος είδος (PDF σε φωτογραφία) ή αντιφατική δήλωση τύπου περνά.
 * - Κ4: το όριο κρίνεται στη ΔΗΛΩΣΗ του πελάτη αντί για τη μέτρηση του κάδου · «έτοιμο» χωρίς μέγεθος περνά.
 * - Κ5: εικόνα χωρίς έτοιμες αποδόσεις (ή με αποδόσεις παλιάς συνταγής) δένεται · SVG/PDF ζητά αποδόσεις.
 */

import { CATALOG_RENDITION_RECIPE_VERSION } from '../../renditions/catalog-renditions';
import { CATALOG_ASSET_MAX_BYTES } from '../../vocabulary/asset-files';
import { attachedFileKindIssues, judgeAssetFile, judgeAssetUpload, type AssetFileTarget } from '../judge-asset-file';

const PHOTO: AssetFileTarget = { companyId: 'comp_1', assetId: 'casst_1', kind: 'image' };
const DATASHEET: AssetFileTarget = { ...PHOTO, kind: 'document' };
const BIM: AssetFileTarget = { ...PHOTO, kind: 'bim' };

const READY_RENDITIONS = { status: 'ready', recipe: CATALOG_RENDITION_RECIPE_VERSION, sourceGeneration: '1' };

const file = (extra: Record<string, unknown> = {}) => ({
  companyId: 'comp_1',
  entityType: 'catalog_asset',
  entityId: 'casst_1',
  status: 'ready',
  storagePath: 'companies/comp_1/entities/catalog_asset/casst_1/domains/catalog/categories/photos/files/file_1.jpg',
  ext: 'jpg',
  contentType: 'image/jpeg',
  sizeBytes: 4_000_000,
  catalogRenditions: READY_RENDITIONS,
  ...extra,
});

const codes = (issues: ReturnType<typeof judgeAssetFile>) => issues.map((i) => i.code);

describe('judgeAssetFile', () => {
  it('✅ φωτογραφία του μέσου, έτοιμη, με αποδόσεις της τρέχουσας συνταγής ⇒ δένεται', () => {
    expect(judgeAssetFile(PHOTO, 'file_1', file(), { storedSizeBytes: 4_000_000 })).toEqual([]);
  });

  it.each([
    ['άλλο μέσο', { entityId: 'casst_2' }],
    ['άλλη εταιρεία', { companyId: 'comp_2' }],
    ['άλλος τύπος οντότητας', { entityType: 'property' }],
  ])('🔴 Κ1 %s ⇒ fileForeignOwner', (_name, extra) => {
    expect(codes(judgeAssetFile(PHOTO, 'file_1', file(extra)))).toEqual(['fileForeignOwner']);
  });

  it('🔴 Κ2 ανύπαρκτο / στον κάδο ⇒ fileNotFound · σε ανέβασμα ⇒ fileNotReady', () => {
    expect(codes(judgeAssetFile(PHOTO, 'file_1', null))).toEqual(['fileNotFound']);
    expect(codes(judgeAssetFile(PHOTO, 'file_1', file({ isDeleted: true })))).toEqual(['fileNotFound']);
    expect(codes(judgeAssetFile(PHOTO, 'file_1', file({ status: 'pending' })))).toEqual(['fileNotReady']);
  });

  it('🔴 Κ3 λάθος είδος ⇒ fileKindMismatch · αντιφατική δήλωση ⇒ fileTypeConflict', () => {
    const pdf = file({ ext: 'pdf', contentType: 'application/pdf' });
    expect(judgeAssetFile(PHOTO, 'file_1', pdf)).toEqual([{ code: 'fileKindMismatch', path: 'fileId', params: { kind: 'image' } }]);
    expect(codes(judgeAssetFile(PHOTO, 'file_1', file({ contentType: 'application/pdf' })))).toEqual(['fileTypeConflict']);
    expect(judgeAssetFile(DATASHEET, 'file_1', pdf)).toEqual([]);
  });

  it('🔴 Κ4 το όριο κρίνεται στη ΜΕΤΡΗΣΗ του κάδου, όχι στη δήλωση του πελάτη', () => {
    const lying = file({ sizeBytes: 1_000 });
    const measured = { storedSizeBytes: CATALOG_ASSET_MAX_BYTES.image + 1 };
    expect(judgeAssetFile(PHOTO, 'file_1', lying, measured)).toEqual([
      { code: 'fileTooLarge', path: 'fileId', params: { maxMb: CATALOG_ASSET_MAX_BYTES.image / (1024 * 1024) } },
    ]);
    // Χωρίς μέτρηση (οθόνη) ⇒ η δήλωση· χωρίς ΚΑΝΕΝΑ μέγεθος ⇒ fail-closed.
    expect(codes(judgeAssetFile(PHOTO, 'file_1', file({ sizeBytes: CATALOG_ASSET_MAX_BYTES.image + 1 })))).toEqual(['fileTooLarge']);
    expect(codes(judgeAssetFile(PHOTO, 'file_1', file({ sizeBytes: undefined })))).toEqual(['fileNotReady']);
  });

  it('BIM: όριο 500 MB, .rfa από browser χωρίς MIME, καμία απόδοση', () => {
    const rfa = file({ ext: 'rfa', contentType: 'application/octet-stream', catalogRenditions: undefined });
    expect(judgeAssetFile(BIM, 'file_1', rfa, { storedSizeBytes: 400 * 1024 * 1024 })).toEqual([]);
    expect(codes(judgeAssetFile(BIM, 'file_1', rfa, { storedSizeBytes: CATALOG_ASSET_MAX_BYTES.bim + 1 }))).toEqual(['fileTooLarge']);
  });

  it('🔴 Κ5 εικόνα χωρίς αποδόσεις / παλιάς συνταγής ⇒ renditionsNotReady · αποτυχημένες ⇒ renditionsFailed με αιτία', () => {
    expect(codes(judgeAssetFile(PHOTO, 'file_1', file({ catalogRenditions: undefined })))).toEqual(['renditionsNotReady']);
    const old = { ...READY_RENDITIONS, recipe: CATALOG_RENDITION_RECIPE_VERSION - 1 };
    expect(codes(judgeAssetFile(PHOTO, 'file_1', file({ catalogRenditions: old })))).toEqual(['renditionsNotReady']);
    const failed = { status: 'failed', recipe: CATALOG_RENDITION_RECIPE_VERSION, sourceGeneration: '1', failure: 'undecodable', failedAt: 'x' };
    expect(judgeAssetFile(PHOTO, 'file_1', file({ catalogRenditions: failed }))).toEqual([
      { code: 'renditionsFailed', path: 'fileId', params: { failure: 'undecodable' } },
    ]);
  });

  it('🔴 Κ5 SVG και PDF δεν ζητούν αποδόσεις', () => {
    const svg = file({ ext: 'svg', contentType: 'image/svg+xml', catalogRenditions: undefined });
    expect(judgeAssetFile(PHOTO, 'file_1', svg)).toEqual([]);
    const pdf = file({ ext: 'pdf', contentType: 'application/pdf', catalogRenditions: undefined });
    expect(judgeAssetFile(DATASHEET, 'file_1', pdf)).toEqual([]);
  });
});

// ADR-923 §5.10.4 — ο προέλεγχος της οθόνης και η κρίση της σύνδεσης είναι ΤΑ ΙΔΙΑ σκέλη τύπου/μεγέθους.
describe('judgeAssetUpload — πριν από κάθε byte', () => {
  it('🔴 Π1 ίδιοι κωδικοί με τη σύνδεση: είδος · αντίφαση · μέγεθος (με όριο), με αυτή τη σειρά', () => {
    expect(judgeAssetUpload('image', { ext: 'pdf', contentType: 'application/pdf', sizeBytes: 1 })).toEqual([{ code: 'fileKindMismatch', path: 'fileId', params: { kind: 'image' } }]);
    expect(judgeAssetUpload('image', { ext: 'jpg', contentType: 'application/pdf', sizeBytes: 1 }).map((i) => i.code)).toEqual(['fileTypeConflict']);
    const over = CATALOG_ASSET_MAX_BYTES.image + 1;
    expect(judgeAssetUpload('image', { ext: 'tif', contentType: 'image/tiff', sizeBytes: over })).toEqual([{ code: 'fileTooLarge', path: 'fileId', params: { maxMb: 200 } }]);
    expect(judgeAssetUpload('bim', { ext: 'rfa', contentType: '', sizeBytes: 1 })).toEqual([]);
  });
});

describe('attachedFileKindIssues — αλλαγή είδους με δεμένο αρχείο', () => {
  it('🔴 Π2 PDF δεμένο, νέο είδος «εικόνα» ⇒ fileKindMismatch στο kind· ίδιο είδος ⇒ τίποτα', () => {
    expect(attachedFileKindIssues('image', { ext: 'pdf', contentType: 'application/pdf' })).toEqual([{ code: 'fileKindMismatch', path: 'kind', params: { kind: 'image' } }]);
    expect(attachedFileKindIssues('document', { ext: 'pdf', contentType: 'application/pdf' })).toEqual([]);
  });
});
