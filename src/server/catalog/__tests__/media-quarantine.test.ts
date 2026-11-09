/**
 * @jest-environment node
 *
 * @fileoverview ADR-934 §5.2.2 Μ-β3 — **η καραντίνα μέσων από διεύθυνση**, με πραγματικούς κριτές (υπογραφή · είδος · μέγεθος),
 *   ψεύτικη βάση και ψεύτικο κάδο:
 *   • δεκτό αρχείο ⇒ ΕΝΑ αντικείμενο στον κάδο της ΕΕ + ΜΙΑ εγγραφή `ready` με κάτοχο το περιεχόμενο + ίχνος `remote_fetch`·
 *   • ίδια bytes από άλλη διεύθυνση ⇒ `alreadyKept`, κανένα δεύτερο αρχείο, κανένα δεύτερο ίχνος·
 *   • σελίδα HTML / λάθος είδος ⇒ κωδικός, **τίποτα** στον κάδο, και η πηγή **ακυρώνεται** (δεν κατεβαίνει το υπόλοιπο)·
 *   • όριο/σιωπή της μεταφοράς ⇒ κωδικός·
 *   • Μ-β5 ανάσταση: εγγραφή στον κάδο ⇒ **επαναφορά** · επιτύμβιο ⇒ **αναγέννηση** · ξένη/αλλοιωμένη ⇒ βλάβη με όνομα.
 */

import { createHash } from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import { OutboundBodyError } from '@/lib/security/outbound-fetch';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { fakeGcsBucket, type FakeGcsStore } from '@/test-utils/fake-gcs/fake-gcs-bucket';

const fake = new FakeFirestore();
const store: FakeGcsStore = new Map();
const bucket = fakeGcsBucket(store, 'files-eu');
const mockAudits: Array<Record<string, unknown>> = [];
const mockPlacements: string[] = [];

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({
  FieldValue: { serverTimestamp: () => '2026-11-09T10:00:00.000Z' },
  getAdminFirestore: (): Firestore => fake as unknown as Firestore,
}));
jest.mock('@/server/files/file-record-bucket', () => ({
  fileStorageBucket: (placement: string) => {
    mockPlacements.push(placement);
    return bucket;
  },
}));
jest.mock('@/services/file-audit-admin.service', () => ({
  recordFileAudit: jest.fn(async (input: Record<string, unknown>) => {
    mockAudits.push(input);
    return 'audit';
  }),
}));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθεί ο γραφέας */
import { CATALOG_MEDIA_STAGING_PREFIX } from '@/subapps/catalog/vocabulary/asset-fetch';
import { MediaContentUnavailableError } from '../media-content-revival.server';
import {
  mediaContentFileIdOf,
  quarantineDownloadedMedia,
  readKeptMediaContent,
  type DownloadedMedia,
} from '../media-quarantine.server';
/* eslint-enable import/first */

const ctx = { uid: 'user_1', companyId: 'comp_1' } as AuthContext;
const FILES = COLLECTIONS[FILE_COLLECTION.company];

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(9000, 0x41)]);
const PDF_SHA = createHash('sha256').update(PDF).digest('hex');
// Μεγαλύτερη από την κεφαλή της κρίσης (8 KiB), όπως μια πραγματική σελίδα σύνδεσης: αλλιώς η προανάγνωση διαβάζει
// ολόκληρη τη ροή και δεν μένει τίποτα να ακυρωθεί — το test δεν θα μετρούσε το «δεν κατεβαίνει το υπόλοιπο».
const HTML = Buffer.concat([
  Buffer.from('<!DOCTYPE html><html><head><title>Sign in</title></head><body>'),
  Buffer.alloc(40_000, 0x20),
  Buffer.from('</body></html>'),
]);

function bodyOf(bytes: Uint8Array, onCancel?: () => void): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.subarray(offset, offset + 1000));
      offset += 1000;
    },
    cancel: () => onCancel?.(),
  });
}

const media = (overrides: Partial<DownloadedMedia> = {}): DownloadedMedia => ({
  role: 'datasheet',
  uri: 'https://cdn.example.com/files/fc-100-datasheet.pdf',
  filename: null,
  contentType: 'application/pdf',
  body: bodyOf(PDF),
  attemptKey: 'ciafx_1/1',
  ...overrides,
});

beforeEach(() => {
  fake.reset();
  store.clear();
  mockAudits.length = 0;
  mockPlacements.length = 0;
});

describe('quarantineDownloadedMedia — δεκτό αρχείο', () => {
  it('ΕΝΑ αντικείμενο + ΜΙΑ εγγραφή `ready` με κάτοχο το περιεχόμενο, στην ΕΕ', async () => {
    const outcome = await quarantineDownloadedMedia(ctx, media());
    const fileId = mediaContentFileIdOf('comp_1', PDF_SHA, 'pdf');
    expect(outcome).toEqual({
      ok: true,
      content: { fileId, sha256: PDF_SHA, sizeBytes: PDF.length, kind: 'document', ext: 'pdf', contentType: 'application/pdf', alreadyKept: false },
    });
    const record = fake.getAllDocs(FILES)[fileId];
    expect(record).toMatchObject({
      companyId: 'comp_1', entityType: 'catalog_media_content', entityId: PDF_SHA, domain: 'catalog', category: 'documents',
      status: 'ready', storagePlacement: 'eu-originals', hash: PDF_SHA, sizeBytes: PDF.length, originalFilename: 'fc-100-datasheet.pdf',
    });
    expect([...store.keys()]).toEqual([record.storagePath]);
    expect(mockPlacements.every((placement) => placement === 'eu-originals')).toBe(true);
  });

  it('ίχνος `remote_fetch` (ποτέ `upload`) με τη διεύθυνση', async () => {
    await quarantineDownloadedMedia(ctx, media());
    expect(mockAudits).toEqual([
      { fileId: mediaContentFileIdOf('comp_1', PDF_SHA, 'pdf'), action: 'remote_fetch', performedBy: 'user_1', companyId: 'comp_1', metadata: { uri: media().uri, revival: 'created' } },
    ]);
  });

  it('🔑 ίδια bytes από ΑΛΛΗ διεύθυνση ⇒ `alreadyKept`, κανένα δεύτερο αρχείο, κανένα δεύτερο ίχνος', async () => {
    await quarantineDownloadedMedia(ctx, media());
    const again = await quarantineDownloadedMedia(ctx, media({ uri: 'https://mirror.example.com/x.pdf', attemptKey: 'ciafx_2/1', body: bodyOf(PDF) }));
    expect(again.ok && again.content.alreadyKept).toBe(true);
    expect(Object.keys(fake.getAllDocs(FILES))).toHaveLength(1);
    expect(store.size).toBe(1);
    expect(mockAudits).toHaveLength(1);
  });

  it('κανένα προσωρινό αντικείμενο δεν μένει πίσω', async () => {
    await quarantineDownloadedMedia(ctx, media());
    expect([...store.keys()].some((key) => key.startsWith(CATALOG_MEDIA_STAGING_PREFIX))).toBe(false);
  });
});

describe('quarantineDownloadedMedia — απόρριψη στα πρώτα bytes', () => {
  it('🔴 σελίδα HTML με 200 ⇒ `notAFile`, τίποτα στον κάδο, η πηγή ΑΚΥΡΩΝΕΤΑΙ', async () => {
    const cancel = jest.fn();
    const outcome = await quarantineDownloadedMedia(ctx, media({ body: bodyOf(HTML, cancel), contentType: 'text/html' }));
    expect(outcome).toEqual({ ok: false, failure: 'notAFile' });
    expect(store.size).toBe(0);
    expect(Object.keys(fake.getAllDocs(FILES))).toHaveLength(0);
    expect(cancel).toHaveBeenCalled();
  });

  it('PDF για ρόλο φωτογραφίας ⇒ `kindMismatch`, τίποτα στον κάδο', async () => {
    const outcome = await quarantineDownloadedMedia(ctx, media({ role: 'photo' }));
    expect(outcome).toEqual({ ok: false, failure: 'kindMismatch' });
    expect(store.size).toBe(0);
  });
});

describe('quarantineDownloadedMedia — αποτυχίες μεταφοράς', () => {
  it.each([
    ['too_large', 'tooLarge'],
    ['timeout', 'timeout'],
  ] as const)('ο φρουρός κόβει τη ροή (%s) ⇒ `%s`, τίποτα στον κάδο', async (code, failure) => {
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) controller.enqueue(PDF.subarray(0, 9000));
        else controller.error(new OutboundBodyError(code));
      },
    });
    expect(await quarantineDownloadedMedia(ctx, media({ body }))).toEqual({ ok: false, failure });
    expect(store.size).toBe(0);
  });
});

describe('quarantineDownloadedMedia — ανάσταση εγγραφής (ADR-934 §5.2.2 Μ-β5)', () => {
  const fileId = () => mediaContentFileIdOf('comp_1', PDF_SHA, 'pdf');
  const again = () => quarantineDownloadedMedia(ctx, media({ attemptKey: 'ciafx_1/2', body: bodyOf(PDF) }));
  const spoil = (fields: Record<string, unknown>) => fake.seed(FILES, fileId(), { ...fake.getAllDocs(FILES)[fileId()], ...fields });
  const TRASH = { isDeleted: true, lifecycleState: 'trashed', purgeAt: '2026-12-09T10:00:00.000Z', trashedBy: 'system:catalog-media-release' };

  it('🔑 στον κάδο ⇒ ΕΠΑΝΑΦΟΡΑ: ζωντανή ξανά, εκτός ουράς εκκαθάρισης, ίχνος `restore`, `alreadyKept`', async () => {
    await quarantineDownloadedMedia(ctx, media());
    spoil(TRASH);
    mockAudits.length = 0;
    const outcome = await again();
    expect(outcome.ok && outcome.content.alreadyKept).toBe(true);
    expect(fake.getAllDocs(FILES)[fileId()]).toMatchObject({ isDeleted: false, lifecycleState: 'active', purgeAt: null, trashedBy: null, restoredBy: 'user_1' });
    expect(mockAudits).toEqual([expect.objectContaining({ fileId: fileId(), action: 'restore', metadata: { uri: media().uri, revival: 'restored' } })]);
  });

  it('🔑 επιτύμβιο (τα bytes έφυγαν) ⇒ ΑΝΑΓΕΝΝΗΣΗ με τα bytes που μόλις ήρθαν, ποτέ `contentUnavailable` για πάντα', async () => {
    await quarantineDownloadedMedia(ctx, media());
    spoil({ ...TRASH, lifecycleState: 'purged', purgeAt: null, purgedAt: '2026-12-09T05:00:00.000Z' });
    store.clear();
    mockAudits.length = 0;
    const outcome = await again();
    expect(outcome.ok && outcome.content.alreadyKept).toBe(true);
    const record = fake.getAllDocs(FILES)[fileId()];
    expect(record).toMatchObject({ isDeleted: false, status: 'ready', hash: PDF_SHA });
    expect(record.lifecycleState).not.toBe('purged');
    expect([...store.keys()]).toEqual([record.storagePath]);
    expect(mockAudits).toEqual([expect.objectContaining({ action: 'remote_fetch', metadata: { uri: media().uri, revival: 'reborn' } })]);
  });

  it('🔴 εγγραφή ΑΛΛΩΝ bytes στο ίδιο κλειδί (αλλοιωμένη) ⇒ βλάβη με όνομα, ποτέ υιοθέτηση ή αντικατάσταση', async () => {
    await quarantineDownloadedMedia(ctx, media());
    spoil({ entityId: 'f'.repeat(64) });
    await expect(again()).rejects.toBeInstanceOf(MediaContentUnavailableError);
    expect(fake.getAllDocs(FILES)[fileId()].entityId).toBe('f'.repeat(64));
  });
});

describe('readKeptMediaContent — ό,τι χρειάζεται το 304 (ADR-934 §5.2.2 Μ-β4)', () => {
  const keptFileId = () => mediaContentFileIdOf('comp_1', PDF_SHA, 'pdf');

  it('ζωντανό περιεχόμενο ⇒ τα στοιχεία του από την εγγραφή, με το είδος από τον τύπο', async () => {
    await quarantineDownloadedMedia(ctx, media());
    expect(await readKeptMediaContent(ctx, keptFileId(), PDF_SHA)).toEqual({
      state: 'live',
      content: { fileId: keptFileId(), sha256: PDF_SHA, sizeBytes: PDF.length, kind: 'document', ext: 'pdf', contentType: 'application/pdf' },
    });
  });

  it('Μ-β5: στον κάδο ⇒ `trashed` με τα στοιχεία του (ο καλών στέλνει validators· 304 ⇒ επαναφορά χωρίς λήψη)', async () => {
    await quarantineDownloadedMedia(ctx, media());
    fake.seed(FILES, keptFileId(), { ...fake.getAllDocs(FILES)[keptFileId()], isDeleted: true, lifecycleState: 'trashed' });
    expect(await readKeptMediaContent(ctx, keptFileId(), PDF_SHA)).toMatchObject({ state: 'trashed', content: { fileId: keptFileId(), sha256: PDF_SHA } });
  });

  it('ανύπαρκτη εγγραφή ⇒ null', async () => {
    expect(await readKeptMediaContent(ctx, keptFileId(), PDF_SHA)).toBeNull();
  });

  it.each([
    ['επιτύμβιο (τα bytes έφυγαν)', { isDeleted: true, lifecycleState: 'purged' }],
    ['άλλα bytes (άλλος κάτοχος)', { entityId: 'f'.repeat(64) }],
  ])('%s ⇒ null (ο καλών κατεβάζει ξανά, χωρίς validators)', async (_name, spoiled) => {
    await quarantineDownloadedMedia(ctx, media());
    fake.seed(FILES, keptFileId(), { ...fake.getAllDocs(FILES)[keptFileId()], ...spoiled });
    expect(await readKeptMediaContent(ctx, keptFileId(), PDF_SHA)).toBeNull();
  });

  it('άλλος χώρος ⇒ null', async () => {
    await quarantineDownloadedMedia(ctx, media());
    expect(await readKeptMediaContent({ uid: 'user_2', companyId: 'comp_2' } as AuthContext, keptFileId(), PDF_SHA)).toBeNull();
  });
});
