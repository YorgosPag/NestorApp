/**
 * @jest-environment node
 *
 * @fileoverview **ΑΝΕΒΑΣΜΑ ΛΗΨΗΣ 360°** (ADR-884 Φ0.8 · §4.5 · Κ3α) — έναρξη + ολοκλήρωση, πάνω σε **πραγματικά** bytes.
 *
 * - **Ε** έναρξη: ο υπεύθυνος **γεννά** την περιήγηση · ο φωτογράφος χρειάζεται **ενεργή** άδεια · άκυρη δήλωση ⇒ καμία συνεδρία.
 * - **Ο** ολοκλήρωση: καραντίνα → κρίση → `FileRecord` READY → **ατοποθέτητη** λήψη με ημερομηνία από το EXIF.
 * - **Ι** ιδεμποτία: δεύτερη ολοκλήρωση ⇒ **ίδια** λήψη, **ένα** αρχείο.
 * - **Α** αρνήσεις: άδεια ανακλήθηκε ανάμεσα · ξένο εισιτήριο · λιγότερα bytes · επίπεδη φωτογραφία · αλλαγή κατόχου ·
 *   δημιουργός άλλος λογαριασμός — κάθε μία ελέγχει **και** τι **δεν** γράφτηκε.
 */

jest.mock('server-only', () => ({}));

type StoredObject = { bytes: Buffer };
const objects = new Map<string, StoredObject>();
const sessions: Array<{ path: string; origin: string; contentLength: number }> = [];
const audits: unknown[] = [];

jest.mock('@/lib/firebaseAdmin', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
  getAdminBucket: () => ({
    file: (path: string) => ({
      exists: async () => [objects.has(path)],
      getMetadata: async () => [{ size: String(objects.get(path)?.bytes.byteLength ?? 0) }],
      download: async () => [objects.get(path)?.bytes ?? Buffer.alloc(0)],
      copy: async (target: { readonly path: string }) => { objects.set(target.path, { bytes: objects.get(path)!.bytes }); },
      delete: async () => { objects.delete(path); },
      createResumableUpload: async (options: { origin: string; metadata: { contentLength: number } }) => {
        sessions.push({ path, origin: options.origin, contentLength: options.metadata.contentLength });
        return [`https://storage.example/upload?session=${sessions.length}`];
      },
      path,
    }),
  }),
}));
jest.mock('@/services/file-audit-admin.service', () => ({
  recordFileAudit: async (input: unknown) => { audits.push(input); return 'audit_1'; },
}));

import type { Firestore } from 'firebase-admin/firestore';
import sharp from 'sharp';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';
import type { TourSubject } from '@/types/spatial-tour';

import { finalizeTourCaptureUpload } from '../tour-capture-finalize';
import { startTourCaptureUpload, tourIngestPath } from '../tour-capture-upload';

process.env.TOUR_UPLOAD_SECRET ??= 'δοκιμαστικό-μυστικό-ανεβάσματος';

const AGENCY = 'comp_agency';
const SUBJECT: TourSubject = { kind: 'company-property', id: 'prop_1' };
const TOUR_ID = enterpriseIdService.generateDeterministicSpatialTourId('company-property', 'prop_1');
const TOURS = COLLECTIONS.SPATIAL_TOURS;
const GRANTS = `${TOURS}/${TOUR_ID}/${SUBCOLLECTIONS.TOUR_CAPTURE_GRANTS}`;
const CAPTURES = `${TOURS}/${TOUR_ID}/${SUBCOLLECTIONS.TOUR_CAPTURES}`;
const ORIGIN = 'http://localhost:3000';
const DAY_MS = 24 * 60 * 60 * 1000;

const MANAGER: TourActor = {
  listing: { uid: 'boris', companyId: AGENCY },
  capability: { globalRole: 'internal_user', permissions: ['listings:listings:publish'] },
};
const PHOTOGRAPHER: TourActor = { listing: { uid: 'uid_photo', companyId: null }, capability: { globalRole: 'external_user', permissions: [] } };

const RIGHTS = {
  creator: { name: 'Πλάτων Φωτογράφος', userId: null, url: null },
  licensors: [],
  copyrightNotice: '© 2026 Πλάτων Φωτογράφος',
  webStatementOfRights: null,
  license: { purpose: 'listing-marketing', term: { kind: 'perpetual' } },
};
const DECLARATION = { source: 'camera-360', audience: 'public-listing', milestone: 'pre-closure', rights: RIGHTS, originalFilename: 'σαλόνι.jpg' };

let kit: MockFirestoreKit;
let db: Firestore;
let panorama: Buffer;
let flat: Buffer;

beforeAll(async () => {
  const base = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 90, g: 110, b: 130 } } });
  panorama = await base(4096, 2048).withExif({ IFD2: { DateTimeOriginal: '2026:08:14 10:30:00' } }).jpeg().toBuffer();
  flat = await base(4096, 3072).jpeg().toBuffer();
});

beforeEach(() => {
  kit = createMockFirestore();
  db = kit.instance as unknown as Firestore;
  objects.clear();
  sessions.length = 0;
  audits.length = 0;
  kit.seedCollection(COLLECTIONS.PROPERTIES, { prop_1: { companyId: AGENCY, name: 'Διαμέρισμα Α2' } });
});

const grantPhotographer = (overrides: Record<string, unknown> = {}) => kit.seedCollection(GRANTS, {
  uid_photo: {
    tourId: TOUR_ID, scopes: ['tour:capture:upload'], expiresAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
    revokedAt: null, revokedBy: null, createdAt: '2026-09-20T10:00:00.000Z', createdBy: 'boris', reason: 'λήψη', invitationId: 'tcin_1',
    ...overrides,
  },
});

async function start(actor: TourActor, bytes: Buffer, contentType = 'image/jpeg') {
  return startTourCaptureUpload(db, { subject: SUBJECT, actor, contentType, contentLength: bytes.byteLength, origin: ORIGIN });
}

/** Έναρξη + «ο φυλλομετρητής ανέβασε» τα bytes στην καραντίνα. */
async function startAndUpload(actor: TourActor, bytes: Buffer) {
  const started = await start(actor, bytes);
  if (started.kind !== 'started') throw new Error(`αναμενόταν έναρξη, ήρθε ${JSON.stringify(started)}`);
  objects.set(tourIngestPath(TOUR_ID, started.uploadId), { bytes });
  return started;
}

const finalize = (ticket: string, actor: TourActor = MANAGER, declaration: unknown = DECLARATION) =>
  finalizeTourCaptureUpload(db, { ticket, actor, declaration });

describe('Ε — η έναρξη', () => {
  it('Ε1 — ο υπεύθυνος σε αγγελία ΧΩΡΙΣ περιήγηση ⇒ τη γεννά, και η συνεδρία ανοίγει στην καραντίνα με το δηλωμένο μήκος', async () => {
    const started = await start(MANAGER, panorama);
    if (started.kind !== 'started') throw new Error(JSON.stringify(started));
    expect(kit.getData(TOURS, TOUR_ID)).toMatchObject({ lifecycle: 'draft' });
    expect(sessions).toEqual([{ path: tourIngestPath(TOUR_ID, started.uploadId), origin: ORIGIN, contentLength: panorama.byteLength }]);
    expect(started.uploadId).toMatch(/^tupl_/);
  });

  it('🔴 Ε2 — φωτογράφος: χωρίς άδεια ⇒ `no-capture-grant` · ανακλημένη ⇒ `revoked` · ενεργή ⇒ ξεκινά', async () => {
    await start(MANAGER, panorama); // η περιήγηση υπάρχει
    sessions.length = 0;
    expect(await start(PHOTOGRAPHER, panorama)).toEqual({ kind: 'refused', reason: 'no-capture-grant' });
    grantPhotographer({ revokedAt: '2026-09-21T10:00:00.000Z', revokedBy: 'boris' });
    expect(await start(PHOTOGRAPHER, panorama)).toEqual({ kind: 'refused', reason: 'revoked' });
    expect(sessions).toHaveLength(0);
    grantPhotographer();
    expect((await start(PHOTOGRAPHER, panorama)).kind).toBe('started');
  });

  it('🔴 Ε3 — φωτογράφος σε αγγελία ΧΩΡΙΣ περιήγηση ⇒ `tour-absent`, ΚΑΜΙΑ γέννηση', async () => {
    expect(await start(PHOTOGRAPHER, panorama)).toEqual({ kind: 'refused', reason: 'tour-absent' });
    expect(kit.getData(TOURS, TOUR_ID)).toBeUndefined();
  });

  it('🔴 Ε4 — δήλωση PNG ή > 40 MB ⇒ άρνηση ΠΡΙΝ από κάθε ανάγνωση βάσης και συνεδρία', async () => {
    expect(await start(MANAGER, panorama, 'image/png')).toEqual({ kind: 'refused', reason: 'not-jpeg' });
    expect(await startTourCaptureUpload(db, { subject: SUBJECT, actor: MANAGER, contentType: 'image/jpeg', contentLength: 41 * 1024 * 1024, origin: ORIGIN }))
      .toEqual({ kind: 'refused', reason: 'too-large' });
    expect(kit.writes()).toHaveLength(0);
    expect(sessions).toHaveLength(0);
  });
});

describe('Ο/Ι — η ολοκλήρωση', () => {
  it('Ο1 — καραντίνα → FileRecord READY (πανοράματα) → ατοποθέτητη λήψη με ημερομηνία EXIF· καραντίνα άδεια', async () => {
    const { ticket, uploadId } = await startAndUpload(MANAGER, panorama);
    const outcome = await finalize(ticket);
    if (outcome.kind !== 'finalized') throw new Error(JSON.stringify(outcome));

    expect(outcome.capture).toMatchObject({ nodeId: null, provenance: 'as-built', source: 'camera-360', milestone: 'pre-closure', uploadedBy: 'boris' });
    expect(outcome.capture.capturedAt).toMatch(/^2026-08-14T/);
    const file = kit.getData(COLLECTIONS.FILES, outcome.capture.originalFileId);
    expect(file).toMatchObject({ companyId: AGENCY, category: 'panoramas', status: 'ready', entityType: 'property', entityId: 'prop_1' });
    // 🔴 Κ3β — ήταν «panoramas panorama» (ωμό `purpose` που ο διακομιστής δεν μεταφράζει). Τώρα: κατηγορία + ακίνητο.
    expect(file).not.toHaveProperty('purpose');
    expect(file?.displayName).toBe('panoramas - Διαμέρισμα Α2');
    expect(objects.has(tourIngestPath(TOUR_ID, uploadId))).toBe(false);
    expect(objects.has(String(file?.storagePath))).toBe(true);
    expect(audits).toEqual([expect.objectContaining({ action: 'upload', fileId: outcome.capture.originalFileId, companyId: AGENCY })]);
  });

  it('🏆 Ι1 — δεύτερη ολοκλήρωση ⇒ ΙΔΙΑ λήψη (replayed), ΕΝΑ αρχείο, ΜΙΑ γραμμή ίχνους', async () => {
    const { ticket } = await startAndUpload(MANAGER, panorama);
    const first = await finalize(ticket);
    const second = await finalize(ticket);
    if (first.kind !== 'finalized' || second.kind !== 'finalized') throw new Error('αναμενόταν ολοκλήρωση');
    expect(second).toMatchObject({ replayed: true, capture: { id: first.capture.id, originalFileId: first.capture.originalFileId } });
    expect(Object.keys(kit.getAllDocs(CAPTURES))).toEqual([first.capture.id]);
    expect(Object.keys(kit.getAllDocs(COLLECTIONS.FILES))).toHaveLength(1);
    expect(audits).toHaveLength(1);
  });
});

describe('Α — οι αρνήσεις', () => {
  it('🔴 Α1 — η άδεια ανακλήθηκε ΑΝΑΜΕΣΑ σε έναρξη και ολοκλήρωση ⇒ `revoked`, ΚΑΜΙΑ λήψη', async () => {
    await start(MANAGER, panorama);
    grantPhotographer();
    const { ticket } = await startAndUpload(PHOTOGRAPHER, panorama);
    grantPhotographer({ revokedAt: new Date().toISOString(), revokedBy: 'boris' });
    expect(await finalize(ticket, PHOTOGRAPHER)).toEqual({ kind: 'refused', reason: 'revoked' });
    expect(kit.getAllDocs(CAPTURES)).toEqual({});
  });

  it('🔴 Α2 — εισιτήριο ΑΛΛΟΥ δράστη ⇒ `ticket-foreign` · αλλοιωμένο ⇒ `ticket-invalid`', async () => {
    const { ticket } = await startAndUpload(MANAGER, panorama);
    grantPhotographer();
    expect(await finalize(ticket, PHOTOGRAPHER)).toEqual({ kind: 'refused', reason: 'ticket-foreign' });
    expect(await finalize(`${ticket}0`)).toEqual({ kind: 'refused', reason: 'ticket-invalid' });
    expect(kit.getAllDocs(CAPTURES)).toEqual({});
  });

  it('🔴 Α3 — λιγότερα bytes από τα δηλωμένα ⇒ `upload-incomplete` · τίποτα στην καραντίνα ⇒ `upload-missing`', async () => {
    const { ticket, uploadId } = await startAndUpload(MANAGER, panorama);
    objects.set(tourIngestPath(TOUR_ID, uploadId), { bytes: panorama.subarray(0, 100) });
    expect(await finalize(ticket)).toEqual({ kind: 'refused', reason: 'upload-incomplete' });
    objects.delete(tourIngestPath(TOUR_ID, uploadId));
    expect(await finalize(ticket)).toEqual({ kind: 'refused', reason: 'upload-missing' });
  });

  it('🔴 Α4 — επίπεδη φωτογραφία ⇒ `not-equirect`, η καραντίνα ΣΒΗΝΕΤΑΙ, ΚΑΝΕΝΑ αρχείο', async () => {
    const started = await start(MANAGER, flat);
    if (started.kind !== 'started') throw new Error(JSON.stringify(started));
    objects.set(tourIngestPath(TOUR_ID, started.uploadId), { bytes: flat });
    expect(await finalize(started.ticket)).toEqual({ kind: 'refused', reason: 'not-equirect' });
    expect(objects.size).toBe(0);
    expect(kit.getAllDocs(COLLECTIONS.FILES)).toEqual({});
  });

  it('🔴 Α5 — η αγγελία άλλαξε χέρια ανάμεσα ⇒ `tour-custody-mismatch`, ΚΑΜΙΑ λήψη', async () => {
    const { ticket } = await startAndUpload(MANAGER, panorama);
    kit.seedCollection(COLLECTIONS.PROPERTIES, { prop_1: { companyId: 'comp_rival', name: 'Διαμέρισμα Α2' } });
    const rival: TourActor = { ...MANAGER, listing: { uid: 'boris', companyId: 'comp_rival' } };
    expect((await finalize(ticket, rival)).kind).toBe('refused');
    expect(kit.getAllDocs(CAPTURES)).toEqual({});
  });

  it('🔴 Α6 — δημιουργός με ΑΛΛΟ λογαριασμό · άγνωστη πηγή · απόδοση BIM ⇒ `declaration-invalid`', async () => {
    const { ticket } = await startAndUpload(MANAGER, panorama);
    const otherCreator = { ...DECLARATION, rights: { ...RIGHTS, creator: { ...RIGHTS.creator, userId: 'someone_else' } } };
    expect(await finalize(ticket, MANAGER, otherCreator)).toEqual({ kind: 'refused', reason: 'declaration-invalid' });
    expect(await finalize(ticket, MANAGER, { ...DECLARATION, source: 'bim-render' })).toEqual({ kind: 'refused', reason: 'declaration-invalid' });
    expect(kit.getAllDocs(CAPTURES)).toEqual({});
  });
});
