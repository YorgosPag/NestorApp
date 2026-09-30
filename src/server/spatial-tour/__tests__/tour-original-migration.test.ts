/**
 * @jest-environment node
 *
 * @fileoverview **ΑΓΚΥΡΕΣ ΤΗΣ ΜΕΤΑΒΑΣΗΣ ΠΡΩΤΟΤΥΠΩΝ ΣΤΗΝ ΕΕ** — ADR-895 Φ4 §7.5.
 *
 * Δύο ψεύτικοι κάδοι (US legacy · EU originals) με crc32c/μέγεθος/γενιά ανά αντικείμενο + το **verified** `FakeFirestore`.
 * Μ μετάβαση · Κ καθαρισμός. 🔴 = κανόνας που, αν σπάσει, σερβίρει 404, αφήνει bytes στις ΗΠΑ ή αντιγράφει χωρίς κλείδωμα.
 */

jest.mock('server-only', () => ({}));

interface FakeObject { crc32c: string; size: number; generation: number; metadata?: Record<string, string> }
type FakeStore = Map<string, FakeObject>;

const us: FakeStore = new Map();
const eu: FakeStore = new Map();
const copyCalls: Array<{ from: string; generation: number | undefined; options: Record<string, unknown> }> = [];
let copyHook: () => void = () => undefined;

function fakeBucket(store: FakeStore, name: string) {
  const bucket = {
    name,
    store,
    file: (path: string, opts?: { generation?: number }) => ({
      name: path,
      bucket,
      store,
      get metadata() { return store.get(path) ?? {}; },
      copy: async (dest: { name: string; store: FakeStore }, options: Record<string, unknown> = {}) => {
        const object = store.get(path);
        if (!object) throw new Error(`404 ${path}`);
        if (opts?.generation !== undefined && opts.generation !== object.generation) throw new Error(`412 γενιά ${path}`);
        copyCalls.push({ from: path, generation: opts?.generation, options });
        const metadata = 'metadata' in options ? (options.metadata as Record<string, string>) : object.metadata;
        dest.store.set(dest.name, { ...object, generation: object.generation + 100, ...(metadata ? { metadata } : {}) });
        copyHook();
      },
      delete: async () => { store.delete(path); },
    }),
    getFiles: async ({ prefix }: { prefix: string }) => [[...store.keys()].filter((key) => key.startsWith(prefix)).map((key) => bucket.file(key))],
  };
  return bucket;
}

const usBucket = fakeBucket(us, 'us');
const euBucket = fakeBucket(eu, 'eu');
const audits: Array<Record<string, unknown>> = [];

jest.mock('@/server/files/file-record-bucket', () => ({
  fileStorageBucket: (placement: string) => (placement === 'eu-originals' ? euBucket : usBucket),
}));
jest.mock('../tour-media-store', () => ({
  effectiveMediaPlacement: (placement: string | undefined) => placement ?? 'legacy-default',
}));
jest.mock('@/services/storage-admin/public-upload.service', () => ({
  buildProxyUrl: (path: string, placement: string = 'legacy-default') =>
    `/api/storage/file/${path}${placement === 'legacy-default' ? '' : `?placement=${placement}`}`,
}));
jest.mock('@/lib/spatial-tour/spatial-tour-from-document', () => ({
  spatialTourFromDocument: (raw: unknown) => raw ?? null,
  tourCaptureFromDocument: (raw: { originalFileId?: unknown }) => (typeof raw.originalFileId === 'string' ? raw : null),
}));
jest.mock('@/services/file-audit-admin.service', () => ({
  recordFileAudit: async (input: Record<string, unknown>) => { audits.push(input); return 'audit_1'; },
}));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }) }));

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

import {
  cleanupTourOriginals,
  migrateTourOriginals,
  ORIGINAL_SOURCE_GRACE_MS,
  type OriginalCleanupOutcome,
  type OriginalMigrationOutcome,
  type TourOriginalsOutcome,
} from '../tour-original-migration';

const TOUR_ID = 'stour_a';
const TOURS = COLLECTIONS.SPATIAL_TOURS;
const FILES = COLLECTIONS.FILES;
const CAPTURES = `${TOURS}/${TOUR_ID}/${SUBCOLLECTIONS.TOUR_CAPTURES}`;
const PATH_1 = 'companies/comp_a/files/file_1.jpg';
const PATH_2 = 'companies/comp_a/files/file_2.jpg';

const fake = new FakeFirestore();
const db = fake as unknown as Firestore;
const tourRef = (): DocumentReference => fake.collection(TOURS).doc(TOUR_ID) as unknown as DocumentReference;

/** Πλήρης εγγραφή — περνά από το **πραγματικό** σύνορο ανάγνωσης (`readFileRecord`, CHECK 3.74), όχι από παράκαμψη. */
const record = (id: string, path: string, extra: Record<string, unknown> = {}) => ({
  id, storagePath: path, status: 'ready', hash: `sha-${id}`, companyId: 'comp_a', downloadUrl: `/api/storage/file/${path}`,
  entityType: 'property', entityId: 'prop_1', domain: 'sales', category: 'panoramas', displayName: `${id}.jpg`,
  originalFilename: `${id}.jpg`, ext: 'jpg', contentType: 'image/jpeg', createdBy: 'uid_1', ...extra,
});

function fileOutcomes<T>(outcome: TourOriginalsOutcome<T>): Record<string, T> {
  if (outcome.kind !== 'done') throw new Error(`αναμενόταν done, ήρθε ${outcome.reason}`);
  return Object.fromEntries(outcome.files.map(({ fileId, outcome: file }) => [fileId, file]));
}

beforeEach(() => {
  fake.reset();
  us.clear(); eu.clear(); copyCalls.length = 0; audits.length = 0; copyHook = () => undefined;
  fake.seed(TOURS, TOUR_ID, { id: TOUR_ID, custody: { companyId: 'comp_a' }, mediaPlacement: 'tour-eu' });
  fake.seed(CAPTURES, 'tcap_1', { id: 'tcap_1', originalFileId: 'file_1', tileset: { state: 'ready' } });
  fake.seed(CAPTURES, 'tcap_2', { id: 'tcap_2', originalFileId: 'file_2', retired: true, tileset: { state: 'ready' } });
  fake.seed(FILES, 'file_1', record('file_1', PATH_1));
  fake.seed(FILES, 'file_2', record('file_2', PATH_2));
  us.set(PATH_1, { crc32c: 'c1', size: 1000, generation: 7 });
  us.set(PATH_2, { crc32c: 'c2', size: 2000, generation: 9 });
});

const migrate = (apply: boolean) => migrateTourOriginals(db, tourRef(), apply);

describe('Μ — μετάβαση πρωτοτύπων', () => {
  it('🔴 Μ1 — ξηρό: σχέδιο με bytes, ΜΗΔΕΝ εγγραφές και ΜΗΔΕΝ αντιγραφές', async () => {
    fake.clearWriteLog();
    const outcomes = fileOutcomes<OriginalMigrationOutcome>(await migrate(false));
    expect(outcomes).toEqual({ file_1: { kind: 'planned', bytes: 1000, copied: 1 }, file_2: { kind: 'planned', bytes: 2000, copied: 1 } });
    expect(fake.writeLog()).toHaveLength(0);
    expect(eu.size).toBe(0);
  });

  it('🔴 Μ2 — apply: αντίγραφο στον EU, θέση + ΝΕΟ proxy URL + ιστορικό μαζί, πηγή ανέπαφη, ίχνος', async () => {
    const outcomes = fileOutcomes<OriginalMigrationOutcome>(await migrate(true));
    expect(outcomes.file_1).toEqual({ kind: 'migrated', bytes: 1000, copied: 1 });
    expect(eu.get(PATH_1)?.crc32c).toBe('c1');
    expect(us.has(PATH_1)).toBe(true);
    const doc = fake.getData(FILES, 'file_1');
    expect(doc?.storagePlacement).toBe('eu-originals');
    expect(doc?.downloadUrl).toBe(`/api/storage/file/${PATH_1}?placement=eu-originals`);
    expect(doc?.placementTransition).toEqual(expect.objectContaining({ from: 'legacy-default', sourcePath: PATH_1 }));
    expect(audits.map((a) => a.action)).toEqual(['storage_relocate', 'storage_relocate']);
  });

  it('🔴 Μ3 — αποσυρμένη λήψη: το πρωτότυπό της ΠΕΡΝΑ (κατοικία = κάθε byte)', async () => {
    expect(fileOutcomes<OriginalMigrationOutcome>(await migrate(true)).file_2.kind).toBe('migrated');
  });

  it('🔴 Μ4 — πλακίδια πρώτα: περιήγηση ακόμη US ⇒ apply δεν αγγίζει τίποτα', async () => {
    fake.seed(TOURS, TOUR_ID, { id: TOUR_ID, custody: { companyId: 'comp_a' } });
    expect(await migrate(true)).toEqual({ kind: 'skipped', reason: 'tiles-first' });
    expect(eu.size).toBe(0);
    expect(fake.getData(FILES, 'file_1')?.storagePlacement).toBeUndefined();
  });

  it('🔴 Μ5 — δέσμευση ⇒ refused ΧΩΡΙΣ αντιγραφή (το rewrite δεν μεταφέρει holds)', async () => {
    fake.seed(FILES, 'file_1', record('file_1', PATH_1, { hold: 'legal' }));
    expect(fileOutcomes<OriginalMigrationOutcome>(await migrate(true)).file_1).toEqual({ kind: 'refused', reason: 'held' });
    expect(eu.has(PATH_1)).toBe(false);
  });

  it('Μ6 — εγγραφή όχι ready ⇒ busy, καμία αντιγραφή', async () => {
    fake.seed(FILES, 'file_1', record('file_1', PATH_1, { status: 'pending' }));
    expect(fileOutcomes<OriginalMigrationOutcome>(await migrate(true)).file_1).toEqual({ kind: 'busy' });
    expect(eu.has(PATH_1)).toBe(false);
  });

  it('🔴 Μ7 — CAS χάνει: το hash άλλαξε ανάμεσα σε αντιγραφή και CAS ⇒ refused/changed, ΚΑΝΕΝΑ flip', async () => {
    copyHook = () => { fake.write(FILES, 'file_1', record('file_1', PATH_1, { hash: 'sha-αλλαγμένο' })); copyHook = () => undefined; };
    expect(fileOutcomes<OriginalMigrationOutcome>(await migrate(true)).file_1).toEqual({ kind: 'refused', reason: 'changed' });
    expect(fake.getData(FILES, 'file_1')?.storagePlacement).toBeUndefined();
  });

  it('🔴 Μ7β — η περιήγηση ΔΕΝ είναι πια στην ΕΕ τη στιγμή του CAS ⇒ refused/changed (ποτέ πρωτότυπο ΕΕ κάτω από πλακίδια ΗΠΑ)', async () => {
    copyHook = () => { fake.write(TOURS, TOUR_ID, { id: TOUR_ID, custody: { companyId: 'comp_a' } }); copyHook = () => undefined; };
    expect(fileOutcomes<OriginalMigrationOutcome>(await migrate(true)).file_1).toEqual({ kind: 'refused', reason: 'changed' });
    expect(fake.getData(FILES, 'file_1')?.storagePlacement).toBeUndefined();
  });

  it('🔴 Μ8 — η αντιγραφή δεν έφτασε πανομοιότυπη ⇒ refused/parity, κανένα flip', async () => {
    copyHook = () => { eu.set(PATH_1, { crc32c: 'χαλασμένο', size: 1000, generation: 1 }); };
    expect(fileOutcomes<OriginalMigrationOutcome>(await migrate(true)).file_1).toEqual({ kind: 'refused', reason: 'parity' });
    expect(fake.getData(FILES, 'file_1')?.storagePlacement).toBeUndefined();
  });

  it('🔴 Μ9 — ΚΑΝΕΝΑ download token στον νέο κάδο· τα άλλα metadata μένουν· γενιά πηγής καρφωμένη', async () => {
    us.set(PATH_1, { crc32c: 'c1', size: 1000, generation: 7, metadata: { firebaseStorageDownloadTokens: 'μυστικό', owner: 'x' } });
    await migrate(true);
    expect(eu.get(PATH_1)?.metadata).toEqual({ owner: 'x' });
    expect(copyCalls.find((call) => call.from === PATH_1)?.generation).toBe(7);
  });

  it('Μ10 — ξανατρέξιμο: δεύτερο apply ⇒ already-moved, μηδέν νέες αντιγραφές', async () => {
    await migrate(true);
    copyCalls.length = 0;
    expect(fileOutcomes<OriginalMigrationOutcome>(await migrate(true)).file_1).toEqual({ kind: 'skipped', reason: 'already-moved' });
    expect(copyCalls).toHaveLength(0);
  });

  it('🔴 Μ12 — εγγραφή που ΔΕΝ περνά το σύνορο ανάγνωσης ⇒ refused/unreadable, καμία αντιγραφή (ποτέ μετάβαση στα τυφλά)', async () => {
    fake.seed(FILES, 'file_1', { ...record('file_1', PATH_1), displayName: undefined });
    expect(fileOutcomes<OriginalMigrationOutcome>(await migrate(true)).file_1).toEqual({ kind: 'refused', reason: 'unreadable' });
    expect(eu.has(PATH_1)).toBe(false);
  });

  it('Μ11 — πηγή λείπει ⇒ refused/source-missing (ποτέ flip πάνω σε bytes που δεν είδαμε)', async () => {
    us.delete(PATH_1);
    expect(fileOutcomes<OriginalMigrationOutcome>(await migrate(true)).file_1).toEqual({ kind: 'refused', reason: 'source-missing' });
  });
});

describe('Κ — καθαρισμός πηγών', () => {
  const cleanup = (afterMs: number) => cleanupTourOriginals(db, tourRef(), Date.now() + afterMs);

  it('Κ1 — χωρίς μετάβαση ⇒ not-migrated, τίποτα δεν σβήνεται', async () => {
    expect(fileOutcomes<OriginalCleanupOutcome>(await cleanup(ORIGINAL_SOURCE_GRACE_MS * 2)).file_1).toEqual({ kind: 'skipped', reason: 'not-migrated' });
    expect(us.has(PATH_1)).toBe(true);
  });

  it('🔴 Κ2 — πριν τη χάρη ⇒ grace, η πηγή μένει', async () => {
    await migrate(true);
    expect(fileOutcomes<OriginalCleanupOutcome>(await cleanup(60_000)).file_1).toEqual({ kind: 'skipped', reason: 'grace' });
    expect(us.has(PATH_1)).toBe(true);
  });

  it('🔴 Κ3 — μετά τη χάρη, με ισοτιμία ⇒ η πηγή σβήνεται + sourceCleanedAt· δεύτερη φορά ⇒ already-cleaned', async () => {
    await migrate(true);
    expect(fileOutcomes<OriginalCleanupOutcome>(await cleanup(ORIGINAL_SOURCE_GRACE_MS + 1)).file_1).toEqual({ kind: 'cleaned', deleted: 1 });
    expect(us.has(PATH_1)).toBe(false);
    expect(eu.has(PATH_1)).toBe(true);
    expect((fake.getData(FILES, 'file_1')?.placementTransition as { sourceCleanedAt?: string }).sourceCleanedAt).toEqual(expect.any(String));
    expect(fileOutcomes<OriginalCleanupOutcome>(await cleanup(ORIGINAL_SOURCE_GRACE_MS + 1)).file_1).toEqual({ kind: 'skipped', reason: 'already-cleaned' });
  });

  it('🔴 Κ4 — το EU αντίγραφο χάθηκε/διαφέρει ⇒ refused/parity, η πηγή ΔΕΝ σβήνεται', async () => {
    await migrate(true);
    eu.set(PATH_1, { crc32c: 'άλλο', size: 1000, generation: 1 });
    expect(fileOutcomes<OriginalCleanupOutcome>(await cleanup(ORIGINAL_SOURCE_GRACE_MS + 1)).file_1).toEqual({ kind: 'refused', reason: 'parity' });
    expect(us.has(PATH_1)).toBe(true);
  });

  it('🔴 Κ5 — εκκαθαρισμένο (GDPR) μετά τη μετάβαση ⇒ η πηγή στις ΗΠΑ ΣΒΗΝΕΤΑΙ (αλλιώς θα έμενε για πάντα χωρίς δείκτη)', async () => {
    await migrate(true);
    const migrated = fake.getData(FILES, 'file_1') ?? {};
    eu.delete(PATH_1);
    fake.write(FILES, 'file_1', { ...migrated, storagePath: null, downloadUrl: null, isDeleted: true, lifecycleState: 'purged' });
    expect(fileOutcomes<OriginalCleanupOutcome>(await cleanup(ORIGINAL_SOURCE_GRACE_MS + 1)).file_1).toEqual({ kind: 'cleaned', deleted: 1 });
    expect(us.has(PATH_1)).toBe(false);
  });
});
