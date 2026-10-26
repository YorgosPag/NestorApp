/**
 * @jest-environment node
 *
 * @fileoverview **Συμπλήρωση διαστάσεων και χρώματος** (ADR-899 §3.7 · ADR-923 §5.10.3) — ανά εγγραφή, ίδιος πυρήνας με τον trigger.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Σ1: εγγραφή με έγκυρες διαστάσεις / μη-raster / χωρίς μονοπάτι ξαναμετριέται.
 * - Σ2: το dry-run γράφει (αντικείμενο ή εγγραφή).
 * - Σ3: μέτρηση που ο trigger ήδη έκανε (metadata γενιάς) ξαναδιαβάζει bytes ή ξαναγράφει metadata.
 * - Σ4: η κεφαλίδα διαβάζεται χωρίς καρφωμένη γενιά ή ως ολόκληρο αρχείο.
 * - Σ5: γενιά που άλλαξε στο μεταξύ ⇒ η εγγραφή γράφεται παρ' όλα αυτά · άγνωστη θέση μαντεύεται.
 * - Σ6: εγγραφή με διαστάσεις αλλά χωρίς χρώμα (πριν τη 2γ) δεν ξαναμετριέται, ή ξαναγράφει metadata που ο trigger έγραψε.
 */

const mockStat = jest.fn();
const mockRead = jest.fn();
const mockWriteMetadata = jest.fn();
jest.mock('@/lib/storage/storage-object-stream', () => ({
  statStorageObject: (...args: unknown[]) => mockStat(...args),
  readStorageObjectGeneration: (...args: unknown[]) => mockRead(...args),
  writeStorageObjectMetadataIfGeneration: (...args: unknown[]) => mockWriteMetadata(...args),
}));

const BUCKET = { name: 'files-bucket' };
const mockBucketOf = jest.fn();
jest.mock('@/server/files/file-record-bucket', () => ({ fileRecordBucket: (record: unknown) => mockBucketOf(record) }));

const mockMetadata = jest.fn();
jest.mock('@/server/images/image-metadata', () => ({ readImageMetadata: (bytes: unknown) => mockMetadata(bytes) }));

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { backfillImageDimensions, needsImageMeasurement } from '../image-dimensions-backfill';

const PATH = 'companies/c1/entities/property/p1/domains/sales/categories/photos/files/file_1.jpg';
const GENERATION = '1727000000123456789';
const RECORD = { storagePath: PATH, contentType: 'image/jpeg' };
const COLOUR = { model: 'rgb', channels: 3, hasAlpha: false, bitsPerSample: 8, density: 72, profile: null };

const txGet = jest.fn();
const txUpdate = jest.fn();
const db = { runTransaction: (fn: (tx: unknown) => Promise<unknown>) => fn({ get: txGet, update: txUpdate }) } as unknown as Firestore;
const REF = { id: 'file_1' } as unknown as DocumentReference;

beforeEach(() => {
  jest.clearAllMocks();
  mockBucketOf.mockReturnValue(BUCKET);
  mockStat.mockResolvedValue({ kind: 'found', generation: GENERATION, contentType: 'image/jpeg', size: 3_000_000, dimensions: null });
  mockRead.mockResolvedValue(Buffer.alloc(128 * 1024));
  mockMetadata.mockResolvedValue({ width: 4000, height: 3000, orientation: 6 });
  mockWriteMetadata.mockResolvedValue('written');
  txGet.mockResolvedValue({ exists: true, data: () => RECORD });
});

describe('needsImageMeasurement', () => {
  it('🔴 Σ1 μόνο raster · με μονοπάτι · χωρίς έγκυρες διαστάσεις ή χωρίς χρώμα', () => {
    expect(needsImageMeasurement(RECORD)).toBe(true);
    expect(needsImageMeasurement({ ...RECORD, imageDimensions: { width: 0, height: 5 }, imageColour: COLOUR })).toBe(true);
    expect(needsImageMeasurement({ ...RECORD, imageDimensions: { width: 3000, height: 4000 }, imageColour: COLOUR })).toBe(false);
    // 🔴 Σ6 διαστάσεις χωρίς χρώμα ⇒ ΧΡΕΙΑΖΕΤΑΙ μέτρηση
    expect(needsImageMeasurement({ ...RECORD, imageDimensions: { width: 3000, height: 4000 } })).toBe(true);
    expect(needsImageMeasurement({ ...RECORD, contentType: 'application/pdf' })).toBe(false);
    expect(needsImageMeasurement({ ...RECORD, storagePath: '' })).toBe(false);
  });
});

describe('backfillImageDimensions', () => {
  it('🔴 Σ4 εκτέλεση: κεφαλίδα καρφωμένης γενιάς → metadata → εγγραφή (διαστάσεις ΘΕΑΤΗ)', async () => {
    expect(await backfillImageDimensions(db, REF, RECORD, false)).toBe('write');
    expect(mockRead).toHaveBeenCalledTimes(1);
    expect(mockRead).toHaveBeenCalledWith(PATH, GENERATION, { bucket: BUCKET, range: { start: 0, end: 128 * 1024 - 1 } });
    expect(mockWriteMetadata).toHaveBeenCalledWith(PATH, GENERATION, { imageWidth: '3000', imageHeight: '4000' }, { bucket: BUCKET });
    expect(txUpdate).toHaveBeenCalledWith(REF, { imageDimensions: { width: 3000, height: 4000 } });
  });

  it('🔴 Σ2 dry-run: μέτρηση, ΚΑΜΙΑ γραφή', async () => {
    expect(await backfillImageDimensions(db, REF, RECORD, true)).toBe('write');
    expect(mockWriteMetadata).not.toHaveBeenCalled();
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it('🔴 Σ3 ο trigger πρόλαβε (metadata γενιάς) και το χρώμα υπάρχει ⇒ κανένα byte, καμία γραφή metadata, μόνο η εγγραφή', async () => {
    mockStat.mockResolvedValue({ kind: 'found', generation: GENERATION, contentType: 'image/jpeg', size: 1, dimensions: { width: 1013, height: 1800 } });
    expect(await backfillImageDimensions(db, REF, { ...RECORD, imageColour: COLOUR }, false)).toBe('write');
    expect(mockRead).not.toHaveBeenCalled();
    expect(mockWriteMetadata).not.toHaveBeenCalled();
    expect(txUpdate).toHaveBeenCalledWith(REF, { imageDimensions: { width: 1013, height: 1800 } });
  });

  it('🔴 Σ6 διαστάσεις στο metadata αλλά ΧΩΡΙΣ χρώμα στην εγγραφή ⇒ κεφαλίδα, καμία γραφή metadata, γράφεται το χρώμα', async () => {
    mockStat.mockResolvedValue({ kind: 'found', generation: GENERATION, contentType: 'image/jpeg', size: 1, dimensions: { width: 3000, height: 4000 } });
    mockMetadata.mockResolvedValue({ width: 4000, height: 3000, orientation: 6, space: 'srgb', channels: 3, depth: 'uchar', density: 72 });
    txGet.mockResolvedValue({ exists: true, data: () => ({ ...RECORD, imageDimensions: { width: 3000, height: 4000 } }) });
    expect(await backfillImageDimensions(db, REF, { ...RECORD, imageDimensions: { width: 3000, height: 4000 } }, false)).toBe('write');
    expect(mockRead).toHaveBeenCalledTimes(1);
    expect(mockWriteMetadata).not.toHaveBeenCalled();
    expect(txUpdate).toHaveBeenCalledWith(REF, {
      imageDimensions: { width: 3000, height: 4000 },
      imageColour: { ...COLOUR, profile: null },
    });
  });

  it('🔴 Σ5 γενιά άλλαξε ⇒ καμία εγγραφή · άγνωστη θέση ⇒ ονομασμένη, χωρίς ανάγνωση', async () => {
    mockWriteMetadata.mockResolvedValue('generation-changed');
    expect(await backfillImageDimensions(db, REF, RECORD, false)).toBe('generation-changed');
    expect(txUpdate).not.toHaveBeenCalled();
    mockBucketOf.mockImplementation(() => {
      throw new Error('unknown placement');
    });
    expect(await backfillImageDimensions(db, REF, { ...RECORD, storagePlacement: 'mars' }, false)).toBe('unknown-placement');
    expect(mockStat).toHaveBeenCalledTimes(1);
  });

  it('ονομασμένες εκβάσεις: απόν · μη μετρήσιμο · η εγγραφή δείχνει πια άλλο αντικείμενο', async () => {
    mockStat.mockResolvedValueOnce({ kind: 'absent' });
    expect(await backfillImageDimensions(db, REF, RECORD, false)).toBe('absent');
    mockMetadata.mockRejectedValueOnce(new Error('bad')).mockRejectedValueOnce(new Error('bad'));
    expect(await backfillImageDimensions(db, REF, RECORD, false)).toBe('not-measurable');
    txGet.mockResolvedValueOnce({ exists: true, data: () => ({ ...RECORD, storagePath: 'other.jpg' }) });
    expect(await backfillImageDimensions(db, REF, RECORD, false)).toBe('not-this-object');
    expect(txUpdate).not.toHaveBeenCalled();
  });
});
