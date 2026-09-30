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
/** Ποιος κάδος (ADR-884 Φ2ζ ζ5): ο κανονικός ή ο ιδιωτικός κάδος μέσων στην ΕΕ. Τα αντικείμενα κλειδώνονται `κάδος|διαδρομή`. */
type FakeBucketName = 'default' | 'tour-eu';
const sessions: Array<{ bucket: FakeBucketName; path: string; origin: string; contentLength: number }> = [];

function fakeBucket(bucket: FakeBucketName) {
  return {
    file: (path: string) => {
      const key = `${bucket}|${path}`;
      return {
        exists: async () => [objects.has(key)],
        getMetadata: async () => [{ size: String(objects.get(key)?.bytes.byteLength ?? 0) }],
        download: async () => [objects.get(key)?.bytes ?? Buffer.alloc(0)],
        copy: async (target: { readonly key: string }) => { objects.set(target.key, { bytes: objects.get(key)!.bytes }); },
        delete: async () => { objects.delete(key); },
        createResumableUpload: async (options: { origin: string; metadata: { contentLength: number } }) => {
          sessions.push({ bucket, path, origin: options.origin, contentLength: options.metadata.contentLength });
          return [`https://storage.example/upload?session=${sessions.length}`];
        },
        key,
      };
    },
  };
}
const audits: unknown[] = [];

jest.mock('@/lib/firebaseAdmin', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
  getAdminBucket: () => fakeBucket('default'),
  getTourMediaBucket: () => fakeBucket('tour-eu'),
}));
jest.mock('@/services/file-audit-admin.service', () => ({
  recordFileAudit: async (input: unknown) => { audits.push(input); return 'audit_1'; },
}));

import type { Firestore } from 'firebase-admin/firestore';
import sharp from 'sharp';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
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

let kit: FakeFirestore;
let db: Firestore;
let panorama: Buffer;
let flat: Buffer;

beforeAll(async () => {
  const base = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 90, g: 110, b: 130 } } });
  panorama = await base(4096, 2048).withExif({ IFD2: { DateTimeOriginal: '2026:08:14 10:30:00' } }).jpeg().toBuffer();
  flat = await base(4096, 3072).jpeg().toBuffer();
});

beforeEach(() => {
  kit = new FakeFirestore();
  db = kit as unknown as Firestore;
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

/** Το κλειδί της καραντίνας **εκεί όπου άνοιξε η συνεδρία** — ο κάδος τον αποφασίζει ο κώδικας, όχι το test. */
function ingestKey(uploadId: string): string {
  const path = tourIngestPath(TOUR_ID, uploadId);
  const session = sessions.find((entry) => entry.path === path);
  if (session === undefined) throw new Error(`καμία συνεδρία για ${path}`);
  return `${session.bucket}|${path}`;
}

async function start(actor: TourActor, bytes: Buffer, contentType = 'image/jpeg') {
  return startTourCaptureUpload(db, { subject: SUBJECT, actor, contentType, contentLength: bytes.byteLength, origin: ORIGIN });
}

/** Έναρξη + «ο φυλλομετρητής ανέβασε» τα bytes στην καραντίνα. */
async function startAndUpload(actor: TourActor, bytes: Buffer) {
  const started = await start(actor, bytes);
  if (started.kind !== 'started') throw new Error(`αναμενόταν έναρξη, ήρθε ${JSON.stringify(started)}`);
  objects.set(ingestKey(started.uploadId), { bytes });
  return started;
}

const finalize = (ticket: string, actor: TourActor = MANAGER, declaration: unknown = DECLARATION) =>
  finalizeTourCaptureUpload(db, { ticket, actor, declaration });

describe('Ε — η έναρξη', () => {
  it('Ε1 — ο υπεύθυνος σε αγγελία ΧΩΡΙΣ περιήγηση ⇒ τη γεννά, και η συνεδρία ανοίγει στην καραντίνα με το δηλωμένο μήκος', async () => {
    const started = await start(MANAGER, panorama);
    if (started.kind !== 'started') throw new Error(JSON.stringify(started));
    expect(kit.getData(TOURS, TOUR_ID)).toMatchObject({ lifecycle: 'draft' });
    // ζ5: νέα περιήγηση ⇒ γεννιέται στον κάδο της ΕΕ, και εκεί ανοίγει η καραντίνα.
    expect(kit.getData(TOURS, TOUR_ID)).toMatchObject({ mediaPlacement: 'tour-eu' });
    expect(sessions).toEqual([
      { bucket: 'tour-eu', path: tourIngestPath(TOUR_ID, started.uploadId), origin: ORIGIN, contentLength: panorama.byteLength },
    ]);
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
    expect(kit.writeLog()).toHaveLength(0);
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
    expect(objects.has(ingestKey(uploadId))).toBe(false);
    // ζ5: το πρωτότυπο είναι `FileRecord` ⇒ ο ΚΑΝΟΝΙΚΟΣ κάδος (ζ5β), όχι ο κάδος μέσων.
    expect(objects.has(`default|${String(file?.storagePath)}`)).toBe(true);
    expect(objects.has(`tour-eu|${String(file?.storagePath)}`)).toBe(false);
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
    objects.set(ingestKey(uploadId), { bytes: panorama.subarray(0, 100) });
    expect(await finalize(ticket)).toEqual({ kind: 'refused', reason: 'upload-incomplete' });
    objects.delete(ingestKey(uploadId));
    expect(await finalize(ticket)).toEqual({ kind: 'refused', reason: 'upload-missing' });
  });

  it('🔴 Α4 — επίπεδη φωτογραφία ⇒ `not-equirect`, η καραντίνα ΣΒΗΝΕΤΑΙ, ΚΑΝΕΝΑ αρχείο', async () => {
    const started = await start(MANAGER, flat);
    if (started.kind !== 'started') throw new Error(JSON.stringify(started));
    objects.set(ingestKey(started.uploadId), { bytes: flat });
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

describe('Θ — θέση μέσων (ADR-884 Φ2ζ ζ5)', () => {
  /** Η περιήγηση όπως ήταν πριν το ζ5 — χωρίς `mediaPlacement`. */
  function makeTourLegacy(): void {
    const { mediaPlacement: _dropped, ...legacy } = kit.getData(TOURS, TOUR_ID) ?? {};
    kit.seedCollection(TOURS, { [TOUR_ID]: legacy });
  }

  it('Θ1 — περιήγηση ΧΩΡΙΣ θέση (πριν το ζ5) ⇒ η καραντίνα ανοίγει στον κανονικό κάδο', async () => {
    await start(MANAGER, panorama);
    makeTourLegacy();
    sessions.length = 0;
    const started = await start(MANAGER, panorama);
    if (started.kind !== 'started') throw new Error(JSON.stringify(started));
    expect(sessions.map((entry) => entry.bucket)).toEqual(['default']);
  });

  it('🔴 Θ2 — η θέση άλλαξε ΑΝΑΜΕΣΑ σε έναρξη και ολοκλήρωση ⇒ η ολοκλήρωση διαβάζει εκεί που ΔΕΣΜΕΥΣΕ το εισιτήριο', async () => {
    const { ticket, uploadId } = await startAndUpload(MANAGER, panorama);
    expect(ingestKey(uploadId)).toMatch(/^tour-eu\|/);
    makeTourLegacy();
    const outcome = await finalize(ticket);
    expect(outcome.kind).toBe('finalized');
    expect(objects.has(ingestKey(uploadId))).toBe(false);
  });
});
