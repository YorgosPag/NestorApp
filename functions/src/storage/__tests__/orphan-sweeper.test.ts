/**
 * ADR-694 Α3 — κλειδώνει τα **τέσσερα φράγματα** πριν από κάθε αυτόματη διαγραφή.
 *
 * Αυτό είναι το μοναδικό σημείο του συστήματος που σβήνει αρχεία Storage. Κάθε test εδώ
 * αντιστοιχεί σε ένα φράγμα· αν κάποιο πέσει, επιστρέφουμε στη συμπεριφορά που κόστισε
 * 61 νόμιμα αρχεία (§2.3).
 *
 *   1. ρητή άδεια (`ORPHAN_SWEEP_ENABLED`) — αλλιώς dry-run
 *   2. θετική απόδειξη ορφανότητας (`custodyKind === 'orphaned'`)
 *   3. ωρίμανση 7 ημερών από την ΠΡΩΤΗ παρατήρηση
 *   4. επανέλεγχος τη στιγμή της διαγραφής
 */

jest.mock('firebase-functions/v1', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  runWith: () => ({
    pubsub: { schedule: () => ({ timeZone: () => ({ onRun: (fn: unknown) => fn }) }) },
  }),
}));

jest.mock('firebase-admin', () => ({
  firestore: Object.assign(() => ({}), {
    Timestamp: { fromDate: (d: Date) => ({ __ts: d.getTime() }) },
    FieldValue: { serverTimestamp: () => '__server_ts' },
  }),
  storage: () => ({ bucket: () => ({}) }),
}));

const mockResolveCustody = jest.fn();
jest.mock('../storage-path-custody', () => ({
  resolveCustody: (...args: unknown[]) => mockResolveCustody(...args),
}));

import { runOrphanSweep } from '../orphan-sweeper';

const ORPHANED = { kind: 'orphaned', rule: 'bim-material-textures', ownerId: 'bmat_1' };
const CLAIMED = { kind: 'claimed', rule: 'bim-material-textures', ownerId: 'bmat_1' };
const PATH = 'companies/c1/bim-material-textures/bmat_1/albedo.jpg';

/** Fake candidate doc — μόνο η επιφάνεια που αγγίζει ο sweeper. */
function candidateDoc(storagePath: string | undefined, deleteSpy: jest.Mock, bucket?: string) {
  return {
    id: 'cand_1',
    get: (field: string) => {
      if (field === 'storagePath') return storagePath;
      if (field === 'bucket') return bucket;
      return undefined;
    },
    ref: { delete: deleteSpy },
  };
}

const BUCKET_NAMES = { 'legacy-default': 'default-bucket', 'eu-originals': 'eu-bucket' } as const;

function fakeDb(docs: ReturnType<typeof candidateDoc>[], auditSet = jest.fn()) {
  return {
    collection: (name: string) =>
      name === 'audit_log'
        ? { doc: () => ({ set: auditSet }) }
        : {
            where: () => ({
              where: () => ({ limit: () => ({ get: async () => ({ docs, size: docs.length }) }) }),
            }),
          },
  } as never;
}

/** Καταγράφει με ΠΟΙΟ όνομα κάδου καλέστηκε το `storage.bucket(...)` (ADR-895 Α7). */
function fakeStorage(deleteFile: jest.Mock, bucketNameSpy: jest.Mock = jest.fn()) {
  return {
    bucket: (name?: string) => {
      bucketNameSpy(name);
      return { file: () => ({ delete: deleteFile }) };
    },
  } as never;
}

const NOW = new Date('2026-08-01T00:00:00Z');

describe('runOrphanSweep — φράγματα πριν τη διαγραφή (ADR-694 Α3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ORPHAN_SWEEP_ENABLED;
  });

  it('🔴 ΦΡΑΓΜΑ 1: χωρίς ρητή άδεια → DRY-RUN, μηδέν διαγραφές (ασφαλές default)', async () => {
    mockResolveCustody.mockResolvedValue(ORPHANED);
    const deleteFile = jest.fn();
    const candidateDelete = jest.fn();

    const out = await runOrphanSweep(
      fakeDb([candidateDoc(PATH, candidateDelete)]),
      fakeStorage(deleteFile),
      NOW,
      BUCKET_NAMES,
    );

    expect(out.dryRun).toBe(true);
    expect(out.deleted).toBe(0);
    expect(deleteFile).not.toHaveBeenCalled();
    // Ο υποψήφιος ΔΕΝ καταναλώνεται σε dry-run — θα ξαναεξεταστεί όταν δοθεί άδεια.
    expect(candidateDelete).not.toHaveBeenCalled();
  });

  it('ΦΡΑΓΜΑ 4: με άδεια, αλλά ο owner εμφανίστηκε στο μεταξύ → healed, ΟΧΙ διαγραφή', async () => {
    process.env.ORPHAN_SWEEP_ENABLED = 'true';
    mockResolveCustody.mockResolvedValue(CLAIMED);
    const deleteFile = jest.fn();
    const candidateDelete = jest.fn();

    const out = await runOrphanSweep(
      fakeDb([candidateDoc(PATH, candidateDelete)]),
      fakeStorage(deleteFile),
      NOW,
      BUCKET_NAMES,
    );

    expect(out.healed).toBe(1);
    expect(out.deleted).toBe(0);
    expect(deleteFile).not.toHaveBeenCalled();
    expect(candidateDelete).toHaveBeenCalled(); // το σημάδι αίρεται
  });

  it('ΦΡΑΓΜΑ 4: «unknown» στον επανέλεγχο → επίσης ΟΧΙ διαγραφή', async () => {
    process.env.ORPHAN_SWEEP_ENABLED = 'true';
    mockResolveCustody.mockResolvedValue({ kind: 'unknown', reason: 'lookup-failed' });
    const deleteFile = jest.fn();

    const out = await runOrphanSweep(
      fakeDb([candidateDoc(PATH, jest.fn())]),
      fakeStorage(deleteFile),
      NOW,
      BUCKET_NAMES,
    );

    expect(out.deleted).toBe(0);
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('όλα τα φράγματα περασμένα → διαγραφή + audit + άρση σημαδιού', async () => {
    process.env.ORPHAN_SWEEP_ENABLED = 'true';
    mockResolveCustody.mockResolvedValue(ORPHANED);
    const deleteFile = jest.fn();
    const candidateDelete = jest.fn();
    const auditSet = jest.fn();

    const out = await runOrphanSweep(
      fakeDb([candidateDoc(PATH, candidateDelete)], auditSet),
      fakeStorage(deleteFile),
      NOW,
      BUCKET_NAMES,
    );

    expect(out.deleted).toBe(1);
    expect(deleteFile).toHaveBeenCalledTimes(1);
    expect(candidateDelete).toHaveBeenCalled();
    expect(auditSet).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORPHAN_FILE_DELETED',
        performedBy: 'system_orphanSweeper',
      }),
    );
  });

  it('υποψήφιος χωρίς `storagePath` → καθαρίζεται, καμία διαγραφή αρχείου', async () => {
    process.env.ORPHAN_SWEEP_ENABLED = 'true';
    const deleteFile = jest.fn();
    const candidateDelete = jest.fn();

    const out = await runOrphanSweep(
      fakeDb([candidateDoc(undefined, candidateDelete)]),
      fakeStorage(deleteFile),
      NOW,
      BUCKET_NAMES,
    );

    expect(out.deleted).toBe(0);
    expect(deleteFile).not.toHaveBeenCalled();
    expect(candidateDelete).toHaveBeenCalled();
  });

  it('σφάλμα σε έναν υποψήφιο δεν ρίχνει ολόκληρη την εκτέλεση (per-item isolation)', async () => {
    process.env.ORPHAN_SWEEP_ENABLED = 'true';
    mockResolveCustody.mockResolvedValue(ORPHANED);
    const deleteFile = jest.fn().mockRejectedValueOnce(new Error('storage boom'));

    const out = await runOrphanSweep(
      fakeDb([candidateDoc(PATH, jest.fn()), candidateDoc(PATH, jest.fn())]),
      fakeStorage(deleteFile),
      NOW,
      BUCKET_NAMES,
    );

    expect(out.examined).toBe(2);
    expect(out.skipped).toBe(1);
    expect(out.deleted).toBe(1);
  });
});

describe('runOrphanSweep — κάδος ΤΟΥ υποψηφίου, όχι πάντα ο κανονικός (ADR-895 Α7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ORPHAN_SWEEP_ENABLED = 'true';
  });
  afterEach(() => {
    delete process.env.ORPHAN_SWEEP_ENABLED;
  });

  it('🔴 candidate σημαδεμένος στον κάδο ΕΕ → η διαγραφή γίνεται ΣΤΟΝ ΚΑΔΟ ΕΕ, όχι στον κανονικό', async () => {
    mockResolveCustody.mockResolvedValue(ORPHANED);
    const deleteFile = jest.fn();
    const bucketNameSpy = jest.fn();

    await runOrphanSweep(
      fakeDb([candidateDoc(PATH, jest.fn(), 'eu-bucket')]),
      fakeStorage(deleteFile, bucketNameSpy),
      NOW,
      BUCKET_NAMES,
    );

    expect(bucketNameSpy).toHaveBeenCalledWith('eu-bucket');
    expect(bucketNameSpy).not.toHaveBeenCalledWith('default-bucket');
    // Ο επανέλεγχος custody ρωτήθηκε ΓΙΑ τον σωστό κάδο.
    expect(mockResolveCustody).toHaveBeenCalledWith(
      expect.anything(),
      PATH,
      { bucketName: 'eu-bucket', bucketNames: BUCKET_NAMES },
    );
  });

  it('candidate ΧΩΡΙΣ πεδίο `bucket` (σημάδι πριν το ADR-895) → fallback στον κανονικό κάδο', async () => {
    mockResolveCustody.mockResolvedValue(ORPHANED);
    const deleteFile = jest.fn();
    const bucketNameSpy = jest.fn();

    await runOrphanSweep(
      fakeDb([candidateDoc(PATH, jest.fn())]), // bucket = undefined
      fakeStorage(deleteFile, bucketNameSpy),
      NOW,
      BUCKET_NAMES,
    );

    expect(bucketNameSpy).toHaveBeenCalledWith('default-bucket');
    expect(mockResolveCustody).toHaveBeenCalledWith(
      expect.anything(),
      PATH,
      { bucketName: 'default-bucket', bucketNames: BUCKET_NAMES },
    );
  });
});
