/**
 * @fileoverview Άγκυρα του κινητήρα δημοσίευσης υλικού αγγελίας (ADR-920 Β4.3).
 * @related server/listing-material/publish-listing-material
 *
 * Οι εταιρικές πόρτες (μοντέλο · κάτοψη · έδαφος) δοκιμάζουν τον κινητήρα **μέσα από** το εταιρικό υποκείμενο.
 * Εδώ ρωτάμε ό,τι αυτές δεν βλέπουν: **η συλλογή ακολουθεί τον δράστη** (προσωπικός ⇒ `files_personal`), ο **ίδιος**
 * δράστης αρχειοθετεί τους προκατόχους, και η σειρά μένει «προκάτοχοι πριν την εγγραφή · επαναπροβολή τελευταία».
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ FieldValue: { serverTimestamp: () => 'ts' } }));

const trace: string[] = [];

const uploadPublicFile = jest.fn(async (_params: { readonly createdBy: string }) => {
  trace.push('upload');
  return { url: '/api/storage/file/x' };
});
jest.mock('@/services/storage-admin/public-upload.service', () => ({
  uploadPublicFile: (params: { readonly createdBy: string }) => uploadPublicFile(params),
}));

const transitionContainer = jest.fn(async (request: { readonly fileId: string; readonly actor: unknown }) => {
  trace.push(`supersede:${request.fileId}`);
  return { kind: 'transitioned', fileId: request.fileId, act: 'supersede', from: 'pre-cde', to: 'SUPERSEDED', revision: 0 };
});
jest.mock('@/services/iso19650/container-transitions', () => ({
  transitionContainer: (request: { readonly fileId: string; readonly actor: unknown }) => transitionContainer(request),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { publishListingMaterial } = require('../publish-listing-material') as
  typeof import('../publish-listing-material');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { COLLECTIONS } = require('@/config/firestore-collections') as typeof import('@/config/firestore-collections');

type Actor = import('@/services/iso19650/container-transitions').ContainerActor;
type BuildPendingFileRecordResult = import('@/services/file-record').BuildPendingFileRecordResult;

const collections: string[] = [];

function fakeDb(): AdminFirestore {
  const doc = (id: string) => ({
    id,
    set: async () => { trace.push('set'); },
    update: async () => { trace.push('update'); },
  });
  const db = { collection: (name: string) => { collections.push(name); return { doc }; } };
  return db as unknown as AdminFirestore;
}

interface Birth { readonly who: string; readonly revisions: number }

function subjectFor(actor: Actor, predecessors: readonly string[] = ['file_old']) {
  return {
    adminDb: fakeDb(),
    listingId: 'ownp_1',
    actor,
    env: { tag: 'env' },
    birthOf: (sourceRevisions: readonly unknown[]): Birth => ({ who: actor.uid, revisions: sourceRevisions.length }),
    readSourceRevisions: jest.fn(async () => []),
    findPredecessors: jest.fn(async () => { trace.push('predecessors'); return predecessors; }),
    refresh: jest.fn(async () => { trace.push('refresh'); return 'published' as const; }),
  };
}

const births: Birth[] = [];
const DOOR = {
  category: 'drawings' as const,
  codes: { uploadFailed: 'UPLOAD_FAILED' },
  read: async () => ({ name: 'terrain.json' }),
  fileOf: () => new File(['{}'], 'terrain.json', { type: 'application/json' }),
  sceneFileIdsOf: () => [],
  recordOf: (_parsed: unknown, birth: Birth) => {
    births.push(birth);
    return { fileId: 'file_new', storagePath: 'p/file_new', recordBase: { id: 'file_new' } } as unknown as BuildPendingFileRecordResult;
  },
  afterSuccession: async () => { trace.push('declare'); return 'declared'; },
};

const PERSONAL: Actor = { uid: 'user_9', custody: { userId: 'user_9' } } as Actor;
const COMPANY: Actor = { uid: 'user_1', custody: { companyId: 'comp_a' } } as Actor;

beforeEach(() => {
  trace.length = 0;
  collections.length = 0;
  births.length = 0;
  jest.clearAllMocks();
});

describe('publishListingMaterial — ο κινητήρας', () => {
  it('προσωπικός δράστης ⇒ η εγγραφή γεννιέται στο files_personal, ποτέ στο files', async () => {
    await publishListingMaterial(new FormData(), subjectFor(PERSONAL), DOOR);
    expect(collections).toEqual([COLLECTIONS.FILES_PERSONAL]);
  });

  it('εταιρικός δράστης ⇒ η εγγραφή γεννιέται στο files', async () => {
    await publishListingMaterial(new FormData(), subjectFor(COMPANY), DOOR);
    expect(collections).toEqual([COLLECTIONS.FILES]);
  });

  it('ο ΙΔΙΟΣ δράστης γράφει (createdBy) και αρχειοθετεί τους προκατόχους', async () => {
    await publishListingMaterial(new FormData(), subjectFor(PERSONAL), DOOR);
    expect(uploadPublicFile.mock.calls[0][0].createdBy).toBe('user_9');
    expect(transitionContainer.mock.calls[0][0].actor).toBe(PERSONAL);
  });

  it('η γέννηση έρχεται από το υποκείμενο, με τα revisions που διάβασε ο διακομιστής', async () => {
    await publishListingMaterial(new FormData(), subjectFor(PERSONAL), DOOR);
    expect(births).toEqual([{ who: 'user_9', revisions: 0 }]);
  });

  it('σειρά: προκάτοχοι πριν την εγγραφή · διαδοχή · δήλωση · επαναπροβολή ΤΕΛΕΥΤΑΙΑ', async () => {
    const published = await publishListingMaterial(new FormData(), subjectFor(PERSONAL), DOOR);
    expect(trace).toEqual(['predecessors', 'set', 'upload', 'update', 'supersede:file_old', 'declare', 'refresh']);
    expect(published).toMatchObject({
      listingId: 'ownp_1', fileId: 'file_new', supersedes: ['file_old'], archived: ['file_old'],
      listing: 'published', declared: 'declared',
    });
  });

  it('αποτυχία ανεβάσματος ⇒ FAILED + ονομαστική άρνηση, χωρίς διαδοχή και χωρίς επαναπροβολή', async () => {
    uploadPublicFile.mockRejectedValueOnce(new Error('boom'));
    const subject = subjectFor(PERSONAL);
    await expect(publishListingMaterial(new FormData(), subject, DOOR)).rejects.toMatchObject({ message: 'UPLOAD_FAILED' });
    expect(transitionContainer).not.toHaveBeenCalled();
    expect(subject.refresh).not.toHaveBeenCalled();
  });
});
