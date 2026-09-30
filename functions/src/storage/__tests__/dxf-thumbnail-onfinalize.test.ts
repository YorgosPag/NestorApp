/**
 * ADR-895 Α7 — η μικρογραφία DXF γράφεται ΣΤΟΝ ΙΔΙΟ κάδο με το πρωτότυπο `.dxf` που την
 * πυροδότησε (`object.bucket`), ΠΟΤΕ πάντα στον κανονικό κάδο. Αλλιώς ένα πρωτότυπο στην
 * ΕΕ θα γεννούσε μικρογραφία στις ΗΠΑ — ίδιο σχήμα σφάλμα με το Ρ6 της ADR-895 §2.3.
 */

jest.mock('firebase-functions/v1', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  runWith: () => ({ storage: { object: () => ({ onFinalize: (f: unknown) => f }) } }),
}));

const bucketSpy = jest.fn();
function fakeBucket(name: string, fileDownload: jest.Mock, fileSave: jest.Mock) {
  return {
    name,
    file: () => ({ download: fileDownload, save: fileSave }),
  };
}

const updateSpy = jest.fn().mockResolvedValue(undefined);
const getSpy = jest.fn();
jest.mock('firebase-admin', () => ({
  firestore: Object.assign(
    () => ({
      collection: () => ({
        doc: () => ({ get: () => getSpy(), update: (...a: unknown[]) => updateSpy(...a) }),
      }),
    }),
    { FieldValue: { serverTimestamp: () => '__ts' } },
  ),
  storage: () => ({ bucket: (name?: string) => bucketSpy(name) }),
}));

jest.mock('../../config/enterprise-id', () => ({
  generateOpaqueToken: () => 'tok_test',
}));

jest.mock('../../shared/dxf-raster-generator', () => ({
  DXF_THUMBNAIL_WIDTH: 1200,
  DXF_THUMBNAIL_HEIGHT: 800,
  rasterizeDxfScene: () => ({
    png: Buffer.from('png-bytes'),
    svgStats: { renderedEntities: 1, skippedEntities: 0 },
  }),
}));

jest.mock('../../generated/lib/dxf/decode-processed-json', () => ({
  decodeProcessedJsonBytes: () => JSON.stringify({ entities: [{ type: 'LINE' }] }),
}));

import { generateDxfThumbnailOnFinalize, regenerateDxfThumbnail } from '../dxf-thumbnail-onfinalize';

describe('regenerateDxfThumbnail — γράφει στον κάδο ΤΟΥ πρωτοτύπου (ADR-895 Α7)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('🔴 bucketName δοσμένο (ΕΕ) → η μικρογραφία γράφεται ΣΤΟΝ ΚΑΔΟ ΕΕ, όχι στον κανονικό', async () => {
    const download = jest.fn().mockResolvedValue([Buffer.from('{}')]);
    const save = jest.fn().mockResolvedValue(undefined);
    bucketSpy.mockReturnValue(fakeBucket('eu-bucket', download, save));

    await regenerateDxfThumbnail({
      dxfStoragePath: 'companies/c1/files/file_1.dxf',
      fileId: 'file_1',
      bucketName: 'eu-bucket',
    });

    expect(bucketSpy).toHaveBeenCalledWith('eu-bucket');
    expect(bucketSpy).not.toHaveBeenCalledWith(undefined);
    expect(save).toHaveBeenCalled();
  });

  it('χωρίς bucketName (π.χ. self-heal εκτός trigger) → ο κανονικός κάδος (χωρίς όνομα)', async () => {
    const download = jest.fn().mockResolvedValue([Buffer.from('{}')]);
    const save = jest.fn().mockResolvedValue(undefined);
    bucketSpy.mockReturnValue(fakeBucket('default-bucket', download, save));

    await regenerateDxfThumbnail({
      dxfStoragePath: 'companies/c1/files/file_1.dxf',
      fileId: 'file_1',
    });

    expect(bucketSpy).toHaveBeenCalledWith(undefined);
  });
});

describe('generateDxfThumbnailOnFinalize — το ΚΟΙΝΟ σώμα gen1/gen2 (ADR-895 Φ2)', () => {
  beforeEach(() => jest.clearAllMocks());

  const euObject = (name: string) =>
    ({ bucket: 'eu-bucket', placement: 'eu-originals', name, contentType: null, size: null }) as const;

  it('🔴 αντικείμενο ΕΕ ⇒ ανάγνωση + μικρογραφία στον κάδο ΕΕ', async () => {
    getSpy.mockResolvedValue({ exists: true, data: () => ({}) });
    const download = jest.fn().mockResolvedValue([Buffer.from('{}')]);
    const save = jest.fn().mockResolvedValue(undefined);
    bucketSpy.mockReturnValue(fakeBucket('eu-bucket', download, save));

    await generateDxfThumbnailOnFinalize(euObject('companies/c1/files/file_1.dxf.processed.json'));

    expect(bucketSpy).toHaveBeenCalledWith('eu-bucket');
    expect(bucketSpy).not.toHaveBeenCalledWith(undefined);
    expect(save).toHaveBeenCalled();
  });

  it('όχι `.dxf.processed.json` ⇒ τίποτα', async () => {
    await generateDxfThumbnailOnFinalize(euObject('companies/c1/files/file_1.dxf'));
    expect(getSpy).not.toHaveBeenCalled();
    expect(bucketSpy).not.toHaveBeenCalled();
  });

  it('μικρογραφία ήδη παρούσα ⇒ καμία ραστεροποίηση (idempotent)', async () => {
    getSpy.mockResolvedValue({ exists: true, data: () => ({ thumbnailUrl: 'https://x' }) });
    await generateDxfThumbnailOnFinalize(euObject('companies/c1/files/file_1.dxf.processed.json'));
    expect(bucketSpy).not.toHaveBeenCalled();
  });
});
