/**
 * ADR-899 §3.7 — ο ΕΝΑΣ γραφέας διαστάσεων στο ανέβασμα.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Η1: λάθος αντιστοίχιση μονοπατιού ⇒ εγγραφή (προσωπικά στη `files`, avatar ως εγγραφή).
 * - Η2: μέτρηση μη-raster τύπου ή επανάληψη γεγονότος που ξανακατεβάζει (το metadata υπάρχει ήδη).
 * - Η3: ανάγνωση χωρίς καρφωμένη γενιά / όλο το αρχείο αντί για κεφαλίδα.
 * - Η4: metadata χωρίς `ifGenerationMatch` · εγγραφή παρότι η γενιά άλλαξε (412).
 * - Η5: εγγραφή για άλλο αντικείμενο ή σε άλλο κάδο.
 * - Η6 (§9 θέμα 6): συνοδευτικό (`_thumb.webp`) μετριέται σαν πρωτότυπο · το log λέει «recorded» χωρίς να γράφτηκε εγγραφή.
 */

import * as functionsV1 from 'firebase-functions/v1';

jest.mock('firebase-functions/v1', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  runWith: () => ({ storage: { object: () => ({ onFinalize: (f: unknown) => f }) } }),
}));

const fileSpy = jest.fn();
const download = jest.fn();
const setMetadata = jest.fn();
const txGet = jest.fn();
const txUpdate = jest.fn();
const docSpy = jest.fn();
const collectionSpy = jest.fn();

jest.mock('firebase-admin', () => ({
  firestore: () => ({
    collection: (name: string) => {
      collectionSpy(name);
      return { doc: (id: string) => docSpy(name, id) };
    },
    runTransaction: (fn: (tx: unknown) => Promise<unknown>) => fn({ get: txGet, update: txUpdate }),
  }),
  storage: () => ({
    bucket: (name?: string) => ({
      name: name ?? 'default-bucket',
      file: (path: string, options: unknown) => {
        fileSpy(path, options);
        return { download, setMetadata };
      },
    }),
  }),
}));

jest.mock('../file-record-bucket', () => ({
  fileStorageBucketNames: () => ({ 'legacy-default': 'default-bucket', 'eu-originals': 'eu-bucket' }),
}));

const metadataSpy = jest.fn();
jest.mock('sharp', () => ({
  __esModule: true,
  default: () => ({ metadata: () => metadataSpy() }),
}));

import { fileRecordRefOf, recordImageDimensionsOnFinalize } from '../image-dimensions-onfinalize';
import type { FinalizedObject } from '../finalized-object';

const NAME = 'companies/comp_1/entities/property/prop_1/domains/sales/categories/photos/files/file_a.jpg';

function object(overrides: Partial<FinalizedObject> = {}): FinalizedObject {
  return {
    bucket: 'default-bucket',
    placement: 'legacy-default',
    name: NAME,
    contentType: 'image/jpeg',
    size: 3_000_000,
    generation: '1727000000123456789',
    metadata: {},
    ...overrides,
  };
}

function recordSnapshot(data: Record<string, unknown> | null) {
  txGet.mockResolvedValue({ exists: data !== null, data: () => data ?? undefined });
}

beforeEach(() => {
  jest.clearAllMocks();
  docSpy.mockImplementation((collection: string, id: string) => ({ collection, id }));
  download.mockResolvedValue([Buffer.alloc(128 * 1024)]);
  setMetadata.mockResolvedValue([{}]);
  metadataSpy.mockResolvedValue({ width: 4000, height: 3000, orientation: 6 });
  recordSnapshot({ storagePath: NAME });
});

describe('fileRecordRefOf', () => {
  it('🔴 Η1 εταιρικά ⇒ files · προσωπικά ⇒ files_personal · ό,τι άλλο ⇒ null', () => {
    expect(fileRecordRefOf(NAME)).toEqual({ collection: 'files', fileId: 'file_a' });
    expect(fileRecordRefOf('people/u_1/entities/property/p/domains/d/categories/photos/files/file_b.png')).toEqual({
      collection: 'files_personal',
      fileId: 'file_b',
    });
    for (const name of ['users/u_1/avatar.png', 'companies/c/files', 'temp/u/files/file_c.jpg', 'companies/c/x/y/z.jpg']) {
      expect(fileRecordRefOf(name)).toBeNull();
    }
  });

  it('🔴 Η6 συνοδευτικό στον ΙΔΙΟ φάκελο ⇒ null (όχι εγγραφή-φάντασμα `file_a_thumb`)', () => {
    const stem = NAME.replace(/\.jpg$/, '');
    for (const name of [`${stem}_thumb.webp`, `${NAME}_thumb.png`, `${NAME}.thumbnail.png`]) {
      expect(fileRecordRefOf(name)).toBeNull();
    }
  });
});

describe('recordImageDimensionsOnFinalize', () => {
  it('🔴 Η3 Η4 κεφαλίδα καρφωμένης γενιάς → metadata με ifGenerationMatch → εγγραφή με διαστάσεις ΘΕΑΤΗ', async () => {
    await recordImageDimensionsOnFinalize(object());
    expect(fileSpy).toHaveBeenCalledWith(NAME, { generation: '1727000000123456789' });
    expect(download).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledWith({ start: 0, end: 128 * 1024 - 1 });
    expect(setMetadata).toHaveBeenCalledWith(
      { metadata: { imageWidth: '3000', imageHeight: '4000' } },
      { ifGenerationMatch: '1727000000123456789' },
    );
    expect(docSpy).toHaveBeenCalledWith('files', 'file_a');
    expect(txUpdate).toHaveBeenCalledWith({ collection: 'files', id: 'file_a' }, { imageDimensions: { width: 3000, height: 4000 } });
  });

  it('🔴 Η2 μη-raster / ήδη μετρημένο / χωρίς γενιά ⇒ ΚΑΜΙΑ ανάγνωση', async () => {
    for (const overrides of [
      { contentType: 'application/pdf' },
      { contentType: 'image/svg+xml' },
      { metadata: { imageWidth: '3000', imageHeight: '4000' } },
      { generation: null },
      { name: 'users/u_1/avatar.png' },
      { name: NAME.replace(/\.jpg$/, '_thumb.webp'), contentType: 'image/webp' },
    ]) {
      await recordImageDimensionsOnFinalize(object(overrides));
    }
    expect(download).not.toHaveBeenCalled();
    expect(setMetadata).not.toHaveBeenCalled();
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it('🔴 Η4 η γενιά άλλαξε (412) ⇒ καμία εγγραφή', async () => {
    setMetadata.mockRejectedValue(Object.assign(new Error('precondition'), { code: 412 }));
    await recordImageDimensionsOnFinalize(object());
    expect(txGet).not.toHaveBeenCalled();
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it('🔴 Η5 εγγραφή για άλλο αντικείμενο / σε άλλο κάδο / ανύπαρκτη / ίδια τιμή ⇒ καμία γραφή εγγραφής', async () => {
    for (const data of [
      { storagePath: `${NAME}_thumb.png` },
      { storagePath: NAME, storagePlacement: 'eu-originals' },
      null,
      { storagePath: NAME, imageDimensions: { width: 3000, height: 4000 } },
    ]) {
      recordSnapshot(data);
      await recordImageDimensionsOnFinalize(object());
    }
    expect(setMetadata).toHaveBeenCalledTimes(4);
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it('🔴 Η5 ΕΕ: αντικείμενο στον κάδο ΕΕ, εγγραφή eu-originals ⇒ γράφεται', async () => {
    recordSnapshot({ storagePath: NAME, storagePlacement: 'eu-originals' });
    await recordImageDimensionsOnFinalize(object({ bucket: 'eu-bucket', placement: 'eu-originals' }));
    expect(txUpdate).toHaveBeenCalledTimes(1);
  });

  it('🔴 Η6 το log λέει την ΕΚΒΑΣΗ: «recorded» μόνο όταν γράφτηκε η εγγραφή', async () => {
    const info = functionsV1.logger.info as jest.Mock;
    const cases: ReadonlyArray<readonly [Record<string, unknown> | null, string, boolean]> = [
      [{ storagePath: NAME }, 'write', true],
      [{ storagePath: NAME, imageDimensions: { width: 3000, height: 4000 } }, 'already-recorded', false],
      [null, 'no-record', false],
      [{ storagePath: `${NAME}.other` }, 'not-this-object', false],
    ];
    const messages = new Set<string>();
    for (const [data, verdict, written] of cases) {
      jest.clearAllMocks();
      setMetadata.mockResolvedValue([{}]);
      recordSnapshot(data);
      await recordImageDimensionsOnFinalize(object());
      expect(info).toHaveBeenCalledTimes(1);
      const [message, fields] = info.mock.calls[0] as [string, { verdict: string }];
      expect(fields.verdict).toBe(verdict);
      expect(message === 'Image dimensions recorded').toBe(written);
      expect(txUpdate).toHaveBeenCalledTimes(written ? 1 : 0);
      messages.add(message);
    }
    expect(messages.size).toBe(cases.length); // κάθε έκβαση το δικό της μήνυμα
  });

  it('μη μετρήσιμο ⇒ τίποτα δεν γράφεται, καμία εξαίρεση', async () => {
    metadataSpy.mockRejectedValue(new Error('unsupported image format'));
    await expect(recordImageDimensionsOnFinalize(object())).resolves.toBeUndefined();
    expect(setMetadata).not.toHaveBeenCalled();
  });
});
