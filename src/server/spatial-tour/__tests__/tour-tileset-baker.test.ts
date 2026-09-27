/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΨΗΣΤΗΣ ΤΟΥ TILESET** (ADR-884 Φ2α · §4.9) — από άκρη σε άκρη πάνω στον κοινό mock, με **πραγματικό** `sharp`.
 *
 * - **Ψ** — λήψη `pending` ⇒ πλακίδια + προεπισκόπηση στη διάταξη ⇒ `ready` με `faceSize` ⇒ ο κριτής των στάσεων τη δέχεται.
 * - **Ι** — ιδεμπότητο: δεύτερο ψήσιμο δεν γράφει τίποτα· ταυτόχρονα ψησίματα ⇒ μία μετάβαση.
 * - **Α** — αποτυχίες: hash που δεν ταιριάζει / αρχείο που λείπει ⇒ `failed`· προσωρινό σφάλμα αποθήκευσης ⇒ μένει `pending`.
 * - **Κ** — η μετάβαση: ποτέ πάνω σε νέο περιεχόμενο (άλλο hash), ποτέ `failed` πάνω σε `ready`.
 */

jest.mock('server-only', () => ({}));
// Πραγματικό `sharp` + mozjpeg· σε φορτωμένο μηχάνημα ένα ψήσιμο ξεπερνά τα 10″ — και η ουρά του ψήστη μεταφέρει
// την καθυστέρηση στο επόμενο test. Λήξη χρόνου εδώ ≠ πιασμένη μετάλλαξη.
jest.setTimeout(120_000);

const objects = new Map<string, { bytes: Buffer; contentType: string | null }>();
let failSaves = false;

jest.mock('@/lib/firebaseAdmin', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
  getAdminBucket: () => ({
    file: (path: string) => ({
      exists: async () => [objects.has(path)],
      download: async () => [objects.get(path)?.bytes ?? Buffer.alloc(0)],
      save: async (bytes: Buffer, options: { contentType?: string }) => {
        if (failSaves) throw new Error('storage unavailable');
        objects.set(path, { bytes, contentType: options.contentType ?? null });
      },
    }),
  }),
}));

import { createHash } from 'node:crypto';

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import sharp from 'sharp';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { tourCaptureFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { previewSegments, tileSegments } from '@/lib/spatial-tour/tileset/tour-tileset-layout';
import { tourMediaObjectPath } from '@/lib/spatial-tour/tour-media-path';
import { TOUR_CUBE_FACES } from '@/lib/spatial-tour/viewer/tour-cube-faces';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';

import { bakeTourTileset } from '../tour-tileset-baker';
import { transitionTileset } from '../tour-tileset-state';
import { viewerStops } from '../tour-viewer-stops';

const AGENCY = 'comp_agency';
const TOUR_ID = 'stour_test';
const TOURS = COLLECTIONS.SPATIAL_TOURS;
const CAPTURES = `${TOURS}/${TOUR_ID}/${SUBCOLLECTIONS.TOUR_CAPTURES}`;
const ORIGINAL_PATH = 'companies/comp_agency/files/file_1.jpg';

let kit: MockFirestoreKit;
let db: Firestore;
let panorama: Buffer;
let hash: string;

beforeAll(async () => {
  // 1024×512 ⇒ όψη 512 ⇒ ένα επίπεδο, ένα πλακίδιο ανά όψη — μικρό, αλλά περνά από όλη τη διαδρομή.
  panorama = await sharp({ create: { width: 1024, height: 512, channels: 3, background: { r: 90, g: 110, b: 130 } } }).jpeg().toBuffer();
  hash = createHash('sha256').update(panorama).digest('hex');
});

function captureDoc(overrides: Record<string, unknown> = {}) {
  return {
    tourId: TOUR_ID, nodeId: 'tnod_1', capturedAt: '2026-09-20T10:00:00.000Z', headingRad: 0, source: 'camera-360',
    provenance: 'as-built', baseCaptureId: null, signatory: null, audience: 'public-listing', milestone: null,
    originalFileId: 'file_1', uploadedBy: 'boris', createdAt: '2026-09-20T10:05:00.000Z',
    rights: {
      creator: { name: 'Φωτογράφος', userId: null, url: null }, licensors: [], copyrightNotice: '© 2026 Φωτογράφος',
      webStatementOfRights: null, license: { purpose: 'listing-marketing', term: { kind: 'perpetual' } },
    },
    tileset: { state: 'pending', contentHash: hash, faceSize: null },
    ...overrides,
  };
}

beforeEach(() => {
  kit = createMockFirestore();
  db = kit.instance as unknown as Firestore;
  objects.clear();
  failSaves = false;
  kit.seedCollection(TOURS, {
    [TOUR_ID]: {
      companyId: AGENCY, subject: { kind: 'company-property', id: 'prop_1' }, visibility: 'public', lifecycle: 'published',
      levels: [], nodes: [], revision: 0, createdAt: '2026-09-01T10:00:00.000Z', createdBy: 'boris',
      updatedAt: '2026-09-01T10:00:00.000Z', updatedBy: 'boris',
    },
  });
  kit.seedCollection(COLLECTIONS.FILES, { file_1: { companyId: AGENCY, storagePath: ORIGINAL_PATH } });
  objects.set(ORIGINAL_PATH, { bytes: panorama, contentType: 'image/jpeg' });
});

const captureRef = (id = 'tcap_1') => db.collection(CAPTURES).doc(id) as unknown as DocumentReference;
const seedCapture = (overrides: Record<string, unknown> = {}, id = 'tcap_1') => kit.seedCollection(CAPTURES, { [id]: captureDoc(overrides) });
async function readCapture(id = 'tcap_1') {
  const snap = await captureRef(id).get();
  return tourCaptureFromDocument(snap.data(), id);
}

describe('Ψ — από pending σε ready', () => {
  it('γράφει κάθε πλακίδιο + την προεπισκόπηση στη διάταξη, και ΜΕΤΑ το ready', async () => {
    seedCapture();
    const outcome = await bakeTourTileset(db, captureRef());
    expect(outcome).toEqual({ kind: 'baked', faceSize: 512, objects: 7, transition: 'written' });
    for (const face of TOUR_CUBE_FACES) {
      const tile = objects.get(tourMediaObjectPath(TOUR_ID, tileSegments(hash, 0, face, 0, 0)) ?? '');
      expect(tile?.contentType).toBe('image/jpeg');
      expect((await sharp(tile!.bytes).metadata()).width).toBe(512);
    }
    const preview = await sharp(objects.get(tourMediaObjectPath(TOUR_ID, previewSegments(hash)) ?? '')!.bytes).metadata();
    expect([preview.width, preview.height]).toEqual([256, 256 * 6]);
    const capture = await readCapture();
    expect(capture?.tileset).toEqual({ state: 'ready', contentHash: hash, faceSize: 512 });
    expect(viewerStops([capture!])).toEqual([expect.objectContaining({ tilesetHash: hash, faceSize: 512 })]);
  });
});

describe('Ι — ιδεμπότητο', () => {
  it('δεύτερο ψήσιμο: τίποτα', async () => {
    seedCapture();
    await bakeTourTileset(db, captureRef());
    expect(await bakeTourTileset(db, captureRef())).toEqual({ kind: 'skipped', reason: 'not-pending' });
  });

  it('δύο ταυτόχρονα εναύσματα (after + δίχτυ) ⇒ μία μετάβαση', async () => {
    seedCapture();
    const [a, b] = await Promise.all([bakeTourTileset(db, captureRef()), bakeTourTileset(db, captureRef())]);
    expect([a.kind, b.kind].sort()).toEqual(['baked', 'skipped']);
  });
});

describe('Α — αποτυχίες', () => {
  it('bytes που δεν ταιριάζουν με το hash ⇒ failed (ξαναδοκιμή δεν βοηθά)', async () => {
    seedCapture({ tileset: { state: 'pending', contentHash: 'b'.repeat(64), faceSize: null } });
    expect(await bakeTourTileset(db, captureRef())).toEqual({ kind: 'failed', reason: 'hash-mismatch' });
    expect((await readCapture())?.tileset.state).toBe('failed');
  });

  it('το πρωτότυπο λείπει ⇒ failed', async () => {
    objects.delete(ORIGINAL_PATH);
    seedCapture();
    expect(await bakeTourTileset(db, captureRef())).toEqual({ kind: 'failed', reason: 'original-missing' });
  });

  it('προσωρινό σφάλμα αποθήκευσης ⇒ μένει pending για το δίχτυ', async () => {
    seedCapture();
    failSaves = true;
    expect((await bakeTourTileset(db, captureRef())).kind).toBe('deferred');
    expect((await readCapture())?.tileset.state).toBe('pending');
  });
});

describe('Κ — η μετάβαση', () => {
  it('νέο περιεχόμενο στο μεταξύ ⇒ κανένα ready για το παλιό', async () => {
    seedCapture({ tileset: { state: 'pending', contentHash: 'c'.repeat(64), faceSize: null } });
    expect(await transitionTileset(db, captureRef(), hash, { to: 'ready', faceSize: 512 })).toBe('hash-changed');
    expect((await readCapture())?.tileset.state).toBe('pending');
  });

  it('ready χωρίς μέγεθος όψης (έγγραφο πριν τη Φ2α) ⇒ καμία στάση — ο θεατής δεν θα ήξερε τα επίπεδα', async () => {
    seedCapture({ tileset: { state: 'ready', contentHash: hash } });
    const capture = await readCapture();
    expect(capture?.tileset.faceSize).toBeNull();
    expect(viewerStops([capture!])).toEqual([]);
  });

  it('ποτέ failed πάνω σε ready', async () => {
    seedCapture({ tileset: { state: 'ready', contentHash: hash, faceSize: 512 } });
    expect(await transitionTileset(db, captureRef(), hash, { to: 'failed' })).toBe('not-pending');
    expect((await readCapture())?.tileset.state).toBe('ready');
  });
});
