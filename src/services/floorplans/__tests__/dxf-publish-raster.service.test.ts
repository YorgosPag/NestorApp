/**
 * @fileoverview 🖼️ **ADR-922 — ο ΕΝΑΣ γραφέας της εικόνας δημοσίευσης** (parser + rasterizer + I/O με mocks).
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | ξαναπόδοση όταν υπάρχει έκβαση (μη ιδεμπότητο) | «ιδεμποτία» |
 * | το PNG γράφεται αλλού από δίπλα στο πρωτότυπο / με download token | «ready» |
 * | λάθος συλλογή (εταιρικό αντί προσωπικού) | «διαμέρισμα» |
 * | βλάβη αποθήκευσης καταγράφεται ως `failed` (καταδικάζει σωστό σχέδιο) | «υποδομή» |
 * | σχέδιο που δεν διαβάζεται ΔΕΝ καταγράφεται (βρόχος αιτήσεων) | «περιεχόμενο» |
 */

import { gzipSync } from 'zlib';

const mockParse = jest.fn();
const mockRasterize = jest.fn();
const mockSave = jest.fn();
const mockDownload = jest.fn();
const mockFile = jest.fn((path: string) => ({ save: (...a: unknown[]) => mockSave(path, ...a), download: () => mockDownload(path) }));

jest.mock('@/app/api/floorplans/process/floorplan-process.service', () => ({
  parseDxfScene: (...args: unknown[]) => mockParse(...args),
}));
jest.mock('@/services/dxf-raster/dxf-publish-rasterizer', () => ({
  rasterizeDxfForPublication: (...args: unknown[]) => mockRasterize(...args),
}));
jest.mock('@/server/files/file-record-bucket', () => ({
  fileRecordBucket: () => ({ file: (path: string) => mockFile(path) }),
}));

import { ensureDxfPublishRaster } from '../dxf-publish-raster.service';

const PATH = 'people/user-1/entities/property_dossier/pdos_a/domains/admin/categories/documents/files/file_a.dxf';
const DXF_BYTES = Buffer.from('0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n');

function firestore() {
  const update = jest.fn().mockResolvedValue(undefined);
  const doc = jest.fn(() => ({ update }));
  const collection = jest.fn(() => ({ doc }));
  return { db: { collection } as never, collection, doc, update };
}

const target = (over: Record<string, unknown> = {}) => ({
  custody: 'personal' as const,
  fileId: 'file_a',
  record: { ext: 'dxf', storagePath: PATH, ...over },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParse.mockResolvedValue({ scene: { entities: [{ type: 'line' }], layers: {} }, encoding: 'utf-8', warnings: [], parseTimeMs: 1 });
  mockRasterize.mockReturnValue({ png: Buffer.from('png'), width: 3000, height: 2000, svgStats: { renderedEntities: 1, skippedEntities: 0 } });
  mockSave.mockResolvedValue(undefined);
  mockDownload.mockResolvedValue([DXF_BYTES]);
});

describe('ensureDxfPublishRaster', () => {
  it('ιδεμποτία — καταγεγραμμένη έκβαση επιστρέφεται χωρίς καμία ανάγνωση ή απόδοση', async () => {
    const { db, update } = firestore();
    const failed = { status: 'failed', failure: 'unreadable', failedAt: 'x' } as const;
    await expect(ensureDxfPublishRaster(db, target({ publishRaster: failed }))).resolves.toBe(failed);
    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockParse).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('μη-DXF / χωρίς bytes ⇒ null, χωρίς I/O', async () => {
    const { db } = firestore();
    await expect(ensureDxfPublishRaster(db, target({ ext: 'pdf' }))).resolves.toBeNull();
    await expect(ensureDxfPublishRaster(db, target({ storagePath: '' }))).resolves.toBeNull();
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it('ready — PNG δίπλα στο πρωτότυπο, ιδιωτικό (χωρίς token), έκβαση στο ΠΡΟΣΩΠΙΚΟ διαμέρισμα', async () => {
    const { db, collection, doc, update } = firestore();
    const state = await ensureDxfPublishRaster(db, target());

    expect(state).toEqual(expect.objectContaining({ status: 'ready', width: 3000, height: 2000 }));
    expect(mockSave).toHaveBeenCalledTimes(1);
    const [savedPath, , options] = mockSave.mock.calls[0] as [string, Buffer, { metadata: { metadata: Record<string, string> } }];
    expect(savedPath).toBe(`${PATH}.publish.png`);
    expect(options.metadata.metadata).not.toHaveProperty('firebaseStorageDownloadTokens');
    expect(collection).toHaveBeenCalledWith('files_personal');
    expect(doc).toHaveBeenCalledWith('file_a');
    expect(update).toHaveBeenCalledWith({ publishRaster: state });
  });

  it('συμπιεσμένο DXF (gzip) ⇒ ο parser παίρνει τα ΑΠΟΣΥΜΠΙΕΣΜΕΝΑ bytes', async () => {
    const { db } = firestore();
    await ensureDxfPublishRaster(db, target(), gzipSync(DXF_BYTES));
    expect(mockDownload).not.toHaveBeenCalled();
    expect((mockParse.mock.calls[0] as [Buffer])[0].equals(DXF_BYTES)).toBe(true);
  });

  it('περιεχόμενο — μη αναγνώσιμο · χωρίς σχεδιάσιμα ⇒ `failed` ΚΑΤΑΓΡΑΦΕΤΑΙ (καμία νέα αίτηση μετά)', async () => {
    const { db, update } = firestore();
    mockParse.mockRejectedValueOnce(new Error('bad group code'));
    await expect(ensureDxfPublishRaster(db, target())).resolves.toEqual(expect.objectContaining({ status: 'failed', failure: 'unreadable' }));

    mockRasterize.mockReturnValueOnce({ png: Buffer.from(''), width: 1, height: 1, svgStats: { renderedEntities: 0, skippedEntities: 4 } });
    await expect(ensureDxfPublishRaster(db, target())).resolves.toEqual(expect.objectContaining({ status: 'failed', failure: 'empty-drawing' }));
    expect(update).toHaveBeenCalledTimes(2);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('υποδομή — βλάβη αποθήκευσης ΠΕΤΑ και ΔΕΝ καταγράφει τίποτα (η επόμενη κλήση ξαναδοκιμάζει)', async () => {
    const { db, update } = firestore();
    mockSave.mockRejectedValueOnce(new Error('503 storage'));
    await expect(ensureDxfPublishRaster(db, target())).rejects.toThrow('503 storage');
    mockDownload.mockRejectedValueOnce(new Error('network'));
    await expect(ensureDxfPublishRaster(db, target())).rejects.toThrow('network');
    expect(update).not.toHaveBeenCalled();
  });
});
