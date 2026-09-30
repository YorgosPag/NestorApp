/**
 * ADR-895 Α7 (Ρ3) — κλειδώνει την **τίμια** διαγραφή: το `files/{fileId}` είναι ο ΜΟΝΟΣ
 * δείκτης προς τα bytes ενός FileRecord. Αν τα bytes ΔΕΝ επιβεβαιωμένα έφυγαν — σφάλμα
 * διαφορετικό από «404 στον σωστό κάδο», ή άγνωστη `storagePlacement` — το `files/{id}`
 * ΠΡΕΠΕΙ να μείνει (retry σε επόμενη εκτέλεση του trigger), αλλιώς χάνεται ο δείκτης ενώ
 * τα bytes μένουν ορφανά και αόρατα (ADR-895 §2.3 Ρ3).
 */

import { COLLECTIONS } from '../../config/firestore-collections';

const PATH = `${COLLECTIONS.FILES}/file_1.pdf`;

/** Φρέσκο module ανά test — διαφορετικός κάδος/σφάλμα διαγραφής ανά σενάριο. */
function loadWithMocks(opts: {
  remaining: number;
  fileExists: boolean;
  fileData?: Record<string, unknown>;
  fileDeleteSpy?: jest.Mock;
  filesDocDeleteSpy: jest.Mock;
  fileRecordBucketImpl: (record: unknown) => { name: string; file: (p: string) => { delete: jest.Mock } };
}): (snap: { data: () => unknown }, context: { params: { rbgId: string } }) => Promise<null> {
  jest.resetModules();

  jest.doMock('firebase-functions/v1', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    runWith: () => ({
      firestore: { document: () => ({ onDelete: (fn: unknown) => fn }) },
    }),
  }));

  jest.doMock('firebase-admin', () => ({
    firestore: () => ({
      collection: (name: string) => {
        if (name === COLLECTIONS.FLOORPLAN_BACKGROUNDS) {
          return {
            where: () => ({
              count: () => ({ get: async () => ({ data: () => ({ count: opts.remaining }) }) }),
            }),
          };
        }
        return {
          doc: () => ({
            get: async () => ({ exists: opts.fileExists, data: () => opts.fileData }),
            delete: opts.filesDocDeleteSpy,
          }),
        };
      },
    }),
  }));

  jest.doMock('../../storage/file-record-bucket', () => ({
    fileRecordBucket: (record: unknown) => opts.fileRecordBucketImpl(record),
  }));

  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  return require('../onDeleteFloorplanBackground').onDeleteFloorplanBackground;
}

function snapWithFileId(fileId: string) {
  return { data: () => ({ fileId }) };
}

const CONTEXT = { params: { rbgId: 'rbg_1' } };

describe('onDeleteFloorplanBackground — τίμια διαγραφή bytes (ADR-895 Α7/Ρ3)', () => {
  it('bytes διαγράφηκαν καθαρά → το files/{id} ΣΒΗΝΕΤΑΙ', async () => {
    const bytesDelete = jest.fn().mockResolvedValue(undefined);
    const filesDocDeleteSpy = jest.fn().mockResolvedValue(undefined);
    const handler = loadWithMocks({
      remaining: 0,
      fileExists: true,
      fileData: { storagePath: PATH },
      filesDocDeleteSpy,
      fileRecordBucketImpl: () => ({ name: 'default-bucket', file: () => ({ delete: bytesDelete }) }),
    });

    await handler(snapWithFileId('file_1'), CONTEXT);

    expect(bytesDelete).toHaveBeenCalled();
    expect(filesDocDeleteSpy).toHaveBeenCalled();
  });

  it('404 ΣΤΟΝ ΣΩΣΤΟ κάδο (η εγγραφή το λέει ήδη απόν) → ασφαλές, files/{id} ΣΒΗΝΕΤΑΙ', async () => {
    const notFound = Object.assign(new Error('not found'), { code: 404 });
    const bytesDelete = jest.fn().mockRejectedValue(notFound);
    const filesDocDeleteSpy = jest.fn().mockResolvedValue(undefined);
    const handler = loadWithMocks({
      remaining: 0,
      fileExists: true,
      fileData: { storagePath: PATH },
      filesDocDeleteSpy,
      fileRecordBucketImpl: () => ({ name: 'default-bucket', file: () => ({ delete: bytesDelete }) }),
    });

    await handler(snapWithFileId('file_1'), CONTEXT);

    expect(filesDocDeleteSpy).toHaveBeenCalled();
  });

  it('🔴 διαγραφή bytes αποτυγχάνει με ΑΛΛΟ σφάλμα (όχι 404) → files/{id} ΜΕΝΕΙ (retry), όχι διαγραφή', async () => {
    const boom = Object.assign(new Error('permission denied'), { code: 403 });
    const bytesDelete = jest.fn().mockRejectedValue(boom);
    const filesDocDeleteSpy = jest.fn();
    const handler = loadWithMocks({
      remaining: 0,
      fileExists: true,
      fileData: { storagePath: PATH },
      filesDocDeleteSpy,
      fileRecordBucketImpl: () => ({ name: 'eu-bucket', file: () => ({ delete: bytesDelete }) }),
    });

    await handler(snapWithFileId('file_1'), CONTEXT);

    expect(bytesDelete).toHaveBeenCalled();
    expect(filesDocDeleteSpy).not.toHaveBeenCalled();
  });

  it('🔴 άγνωστη storagePlacement (fileRecordBucket πετά) → files/{id} ΜΕΝΕΙ, καμία απόπειρα διαγραφής bytes σε λάθος κάδο', async () => {
    const filesDocDeleteSpy = jest.fn();
    const handler = loadWithMocks({
      remaining: 0,
      fileExists: true,
      fileData: { storagePath: PATH, storagePlacement: 'nowhere' },
      filesDocDeleteSpy,
      fileRecordBucketImpl: () => {
        throw new Error('Unknown FileRecord.storagePlacement: "nowhere"');
      },
    });

    await handler(snapWithFileId('file_1'), CONTEXT);

    expect(filesDocDeleteSpy).not.toHaveBeenCalled();
  });

  it('χωρίς storagePath καθόλου → προχωρά κατευθείαν σε διαγραφή του files/{id} (καμία αλλαγή συμπεριφοράς)', async () => {
    const filesDocDeleteSpy = jest.fn().mockResolvedValue(undefined);
    const handler = loadWithMocks({
      remaining: 0,
      fileExists: true,
      fileData: {},
      filesDocDeleteSpy,
      fileRecordBucketImpl: () => {
        throw new Error('should not be called — no storagePath');
      },
    });

    await handler(snapWithFileId('file_1'), CONTEXT);

    expect(filesDocDeleteSpy).toHaveBeenCalled();
  });

  it('ακόμη υπάρχουν αναφορές (remaining > 0) → καμία επαφή με Storage/files', async () => {
    const filesDocDeleteSpy = jest.fn();
    const handler = loadWithMocks({
      remaining: 1,
      fileExists: true,
      fileData: { storagePath: PATH },
      filesDocDeleteSpy,
      fileRecordBucketImpl: () => {
        throw new Error('should not be called — still referenced');
      },
    });

    await handler(snapWithFileId('file_1'), CONTEXT);

    expect(filesDocDeleteSpy).not.toHaveBeenCalled();
  });
});
