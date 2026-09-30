/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΨΗΣΤΗΣ ΤΟΥ TILESET** (ADR-884 Φ2α · §4.9) — από άκρη σε άκρη πάνω στον κοινό mock, με **πραγματικό** `sharp`.
 *
 * - **Ψ** — λήψη `pending` ⇒ πλακίδια + προεπισκόπηση στη διάταξη ⇒ `ready` με `faceSize` ⇒ ο κριτής των στάσεων τη δέχεται.
 * - **Ι** — ιδεμπότητο: δεύτερο ψήσιμο δεν γράφει τίποτα· ταυτόχρονα ψησίματα ⇒ μία μετάβαση.
 * - **Α** — αποτυχίες: hash που δεν ταιριάζει / αρχείο που λείπει ⇒ `failed`· προσωρινό σφάλμα αποθήκευσης ⇒ μένει `pending`.
 * - **Κ** — η μετάβαση: ποτέ πάνω σε νέο περιεχόμενο (άλλο hash), ποτέ `failed` πάνω σε `ready`.
 * - **Π** — πρόσωπα (ζ4): σάρωση ΠΡΙΝ τη δημοσίευση με τον πραγματικό ανιχνευτή· το κλειδί του πρωτοτύπου δεν ανεβαίνει ποτέ·
 *   ανιχνευτής που λείπει ⇒ `deferred` και ΚΑΝΕΝΑ πλακίδιο· σαρωμένη λήψη δεν ξανασαρώνεται.
 * - **Β** — backfill (ζ4): 0 πρόσωπα ⇒ μόνο ίχνος, καμία επανα-ψήση· πρόσωπα ⇒ νέο κλειδί, τα παλιά πλακίδια σβήνονται.
 */

jest.mock('server-only', () => ({}));
// Πραγματικό `sharp` + mozjpeg· σε φορτωμένο μηχάνημα ένα ψήσιμο ξεπερνά τα 10″ — και η ουρά του ψήστη μεταφέρει
// την καθυστέρηση στο επόμενο test. Λήξη χρόνου εδώ ≠ πιασμένη μετάλλαξη.
jest.setTimeout(120_000);

type StoredObject = { bytes: Buffer; contentType: string | null };
/** Ο κανονικός κάδος (πρωτότυπα + μέσα περιηγήσεων πριν το ζ5). */
const objects = new Map<string, StoredObject>();
/** Ο ιδιωτικός κάδος μέσων στην ΕΕ (ADR-884 Φ2ζ ζ5). */
const euObjects = new Map<string, StoredObject>();
let failSaves = false;
/** Άγκιστρο στην πρώτη αποθήκευση — προσομοιώνει αλλαγή θολώματος ΕΝΩ ψήνεται (Φ2ζ). */
let onFirstSave: (() => Promise<void>) | null = null;

jest.mock('@/lib/firebaseAdmin', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
  getAdminBucket: () => fakeBucket(objects),
  getTourMediaBucket: () => fakeBucket(euObjects),
}));

function fakeBucket(store: Map<string, StoredObject>) {
  return {
    file: (path: string) => ({
      exists: async () => [store.has(path)],
      download: async () => [store.get(path)?.bytes ?? Buffer.alloc(0)],
      save: async (bytes: Buffer, options: { contentType?: string }) => {
        if (failSaves) throw new Error('storage unavailable');
        const hook = onFirstSave;
        onFirstSave = null;
        if (hook !== null) await hook();
        store.set(path, { bytes, contentType: options.contentType ?? null });
      },
    }),
    deleteFiles: async ({ prefix }: { prefix: string }) => {
      for (const path of [...store.keys()]) if (path.startsWith(prefix)) store.delete(path);
    },
  };
}

import { createHash } from 'node:crypto';

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import sharp from 'sharp';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { tourCaptureFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { previewSegments, tileSegments } from '@/lib/spatial-tour/tileset/tour-tileset-layout';
import { tourMediaObjectPath } from '@/lib/spatial-tour/tour-media-path';
import { TOUR_FACE_DETECTOR_VERSION } from '@/constants/spatial-tour-vocabulary';
import { TOUR_CUBE_FACES } from '@/lib/spatial-tour/viewer/tour-cube-faces';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';

import type { TourRedaction } from '@/types/spatial-tour';

import { disposeFaceDetector } from '../face-detection/yunet-session';
import { backfillFaceScan } from '../tour-face-backfill';
import { tilesetKeyOf } from '../tour-redaction-apply';
import { bakeTourTileset } from '../tour-tileset-baker';
import { transitionTileset } from '../tour-tileset-state';
import { viewerStops } from '../tour-viewer-stops';
import { equirectWithFaces } from './fixtures/face-equirect';

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
  euObjects.clear();
  failSaves = false;
  onFirstSave = null;
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

afterAll(() => disposeFaceDetector());

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

describe('Θ — θόλωμα (Φ2ζ · §4.15 · Α8)', () => {
  const REGION = { id: 'tred_1', yawRad: 0, pitchRad: 0, radiusRad: 0.5, source: 'manual', createdBy: 'boris', createdAt: '2026-09-29T10:00:00.000Z' };
  let checker: Buffer;
  let checkerHash: string;

  beforeAll(async () => {
    // Σκακιέρα 4 px: υψηλή αντίθεση παντού — ό,τι θολώθηκε φαίνεται ως πτώση της διασποράς.
    const [w, h, cell] = [1024, 512, 4];
    const raw = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.fill((Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0 ? 0 : 255, (y * w + x) * 3, (y * w + x) * 3 + 3);
    checker = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
    checkerHash = createHash('sha256').update(checker).digest('hex');
  });

  const seedRedacted = (tileset: Record<string, unknown> = {}) => {
    objects.set(ORIGINAL_PATH, { bytes: checker, contentType: 'image/jpeg' });
    const key = tilesetKeyOf(checkerHash, [REGION as TourRedaction]);
    seedCapture({ originalHash: checkerHash, redactions: [REGION], tileset: { state: 'pending', contentHash: key, faceSize: null, ...tileset } });
    return key;
  };

  async function centreSpread(key: string, face: (typeof TOUR_CUBE_FACES)[number]): Promise<number> {
    const tile = objects.get(tourMediaObjectPath(TOUR_ID, tileSegments(key, 0, face, 0, 0)) ?? '')!;
    // ⚠️ `stats()` μετρά την ΕΙΣΟΔΟ του pipeline, όχι το αποκομμένο — πρώτα `toBuffer()` (μετρημένο: αλλιώς centre ≡ full).
    const centre = await sharp(tile.bytes).extract({ left: 192, top: 192, width: 128, height: 128 }).toBuffer();
    const stats = await sharp(centre).stats();
    return stats.channels[0].stdev;
  }

  it('επαληθεύει με το hash του ΠΡΩΤΟΤΥΠΟΥ, γράφει στο ΚΛΕΙΔΙ · ακριβώς μία όψη θολωμένη στο κέντρο, οι άλλες ανέπαφες', async () => {
    const key = seedRedacted();
    expect(await bakeTourTileset(db, captureRef())).toMatchObject({ kind: 'baked', transition: 'written' });
    const spreads = await Promise.all(TOUR_CUBE_FACES.map((face) => centreSpread(key, face)));
    expect(spreads.filter((s) => s < 12)).toHaveLength(1);
    expect(spreads.filter((s) => s > 60)).toHaveLength(5);
    expect([...objects.keys()].some((path) => path.includes(checkerHash))).toBe(false);
    expect((await readCapture())?.tileset).toEqual({ state: 'ready', contentHash: key, faceSize: 512 });
  });

  it('τα αποσυρμένα κλειδιά σβήνονται ΠΡΙΝ το ψήσιμο · η λίστα αδειάζει με το ready', async () => {
    const old = 'd'.repeat(64);
    const oldTile = tourMediaObjectPath(TOUR_ID, tileSegments(old, 0, TOUR_CUBE_FACES[0], 0, 0))!;
    objects.set(oldTile, { bytes: Buffer.from('unblurred'), contentType: 'image/jpeg' });
    seedRedacted({ retiredKeys: [old] });
    await bakeTourTileset(db, captureRef());
    expect(objects.has(oldTile)).toBe(false);
    expect((await readCapture())?.tileset).not.toHaveProperty('retiredKeys');
  });

  it('το θόλωμα άλλαξε ΕΝΩ έψηνε ⇒ ό,τι ανέβηκε για το παλιό κλειδί σβήνεται, καμία μετάβαση', async () => {
    const key = seedRedacted();
    onFirstSave = async () => { await captureRef().update({ tileset: { state: 'pending', contentHash: 'e'.repeat(64), faceSize: null } }); };
    expect(await bakeTourTileset(db, captureRef())).toMatchObject({ kind: 'baked', transition: 'hash-changed' });
    expect([...objects.keys()].some((path) => path.startsWith(`${tourMediaObjectPath(TOUR_ID, [key])}/`))).toBe(false);
    expect((await readCapture())?.tileset.contentHash).toBe('e'.repeat(64));
  });
});

describe('Π — πρόσωπα: σάρωση ΠΡΙΝ από κάθε δημοσίευση (Φ2ζ ζ4 · §4.15)', () => {
  let withFace: Buffer;
  let faceHash: string;

  beforeAll(async () => {
    withFace = await equirectWithFaces(1024, [{ yawRad: 0, pitchRad: 0, widthRad: 0.6 }]);
    faceHash = createHash('sha256').update(withFace).digest('hex');
  });

  const seedFace = (overrides: Record<string, unknown> = {}) => {
    objects.set(ORIGINAL_PATH, { bytes: withFace, contentType: 'image/jpeg' });
    seedCapture({ tileset: { state: 'pending', contentHash: faceHash, faceSize: null }, ...overrides });
  };
  const uploadedUnder = (key: string) => [...objects.keys()].filter((path) => path.startsWith(`${tourMediaObjectPath(TOUR_ID, [key])}/`));

  async function withBrokenDetector<T>(run: () => Promise<T>): Promise<T> {
    const previous = process.env.FACE_MODEL_DIR;
    process.env.FACE_MODEL_DIR = '/no/such/model/dir';
    await disposeFaceDetector();
    try {
      return await run();
    } finally {
      if (previous === undefined) delete process.env.FACE_MODEL_DIR;
      else process.env.FACE_MODEL_DIR = previous;
      await disposeFaceDetector();
    }
  }

  it('πρόσωπο ⇒ auto περιοχή (σύστημα) · ψήνεται στο ΝΕΟ κλειδί · το κλειδί του πρωτοτύπου δεν ανεβαίνει ΠΟΤΕ · revision + 1', async () => {
    seedFace();
    expect(await bakeTourTileset(db, captureRef())).toMatchObject({ kind: 'baked', transition: 'written' });
    const capture = await readCapture();
    expect(capture?.redactions?.map((r) => [r.source, r.createdBy])).toEqual([['auto', 'system']]);
    expect(capture?.faceScan).toMatchObject({ version: TOUR_FACE_DETECTOR_VERSION, faces: 1, added: 1, saturated: false });
    const key = tilesetKeyOf(faceHash, capture?.redactions ?? []);
    expect(key).not.toBe(faceHash);
    expect(capture?.tileset).toEqual({ state: 'ready', contentHash: key, faceSize: 512 });
    expect(uploadedUnder(faceHash)).toEqual([]);
    expect(uploadedUnder(key)).toHaveLength(7);
    expect((await db.collection(TOURS).doc(TOUR_ID).get()).data()?.revision).toBe(1);
  });

  it('ανιχνευτής που λείπει ⇒ deferred · ΚΑΝΕΝΑ πλακίδιο · η λήψη μένει pending, χωρίς ίχνος σάρωσης (fail-closed)', async () => {
    seedFace();
    expect((await withBrokenDetector(() => bakeTourTileset(db, captureRef()))).kind).toBe('deferred');
    expect([...objects.keys()]).toEqual([ORIGINAL_PATH]);
    const capture = await readCapture();
    expect(capture?.tileset).toEqual({ state: 'pending', contentHash: faceHash, faceSize: null });
    expect(capture).not.toHaveProperty('faceScan');
  });

  it('ήδη σαρωμένη από αυτή την έκδοση ⇒ ΔΕΝ ξανασαρώνεται (ό,τι έσβησε ο άνθρωπος μένει σβησμένο)', async () => {
    seedFace({ faceScan: { version: TOUR_FACE_DETECTOR_VERSION, faces: 1, added: 1, saturated: false, at: '2026-09-29T12:00:00.000Z' } });
    expect(await withBrokenDetector(() => bakeTourTileset(db, captureRef()))).toMatchObject({ kind: 'baked' });
    expect((await readCapture())?.redactions).toBeUndefined();
  });

  it('failed ΚΡΑΤΑ τα αποσυρμένα κλειδιά — «είχε δημοσιευμένα, τίποτα δεν πήρε τη θέση τους»', async () => {
    const tileset = { state: 'pending', contentHash: 'k'.repeat(64), faceSize: null, retiredKeys: ['r'.repeat(64)] };
    seedCapture({ originalHash: 'b'.repeat(64), tileset });
    expect(await bakeTourTileset(db, captureRef())).toEqual({ kind: 'failed', reason: 'hash-mismatch' });
    expect((await readCapture())?.tileset).toEqual({ ...tileset, state: 'failed' });
  });

  describe('Β — backfill λήψεων που ψήθηκαν πριν το ζ4', () => {
    const READY = (key: string) => ({ tileset: { state: 'ready', contentHash: key, faceSize: 512 } });

    it('χωρίς πρόσωπα: ξηρό ⇒ μέτρηση, τίποτα δεν γράφεται · γραφή ⇒ μόνο το ίχνος, ΚΑΜΙΑ επανα-ψήση, ίδιο κλειδί', async () => {
      seedCapture(READY(hash));
      expect(await backfillFaceScan(db, captureRef(), false)).toEqual({ kind: 'would-record', faces: 0 });
      expect(await readCapture()).not.toHaveProperty('faceScan');
      expect(await backfillFaceScan(db, captureRef(), true)).toEqual({ kind: 'recorded', faces: 0, added: 0, bake: null });
      const capture = await readCapture();
      expect(capture?.tileset).toEqual({ state: 'ready', contentHash: hash, faceSize: 512 });
      expect(capture?.faceScan).toMatchObject({ faces: 0 });
      expect(await backfillFaceScan(db, captureRef(), true)).toEqual({ kind: 'current' });
    });

    it('με πρόσωπο: νέο κλειδί · τα ΠΑΛΙΑ πλακίδια (έδειχναν το πρόσωπο) σβήνονται · ready στο θολωμένο', async () => {
      objects.set(ORIGINAL_PATH, { bytes: withFace, contentType: 'image/jpeg' });
      const oldTile = tourMediaObjectPath(TOUR_ID, tileSegments(faceHash, 0, TOUR_CUBE_FACES[0], 0, 0))!;
      objects.set(oldTile, { bytes: Buffer.from('unblurred face'), contentType: 'image/jpeg' });
      seedCapture(READY(faceHash));
      expect(await backfillFaceScan(db, captureRef(), false)).toEqual({ kind: 'would-record', faces: 1 });
      expect(await backfillFaceScan(db, captureRef(), true)).toMatchObject({ kind: 'recorded', faces: 1, added: 1, bake: { kind: 'baked', transition: 'written' } });
      const capture = await readCapture();
      expect(objects.has(oldTile)).toBe(false);
      expect(capture?.tileset).toEqual({ state: 'ready', contentHash: tilesetKeyOf(faceHash, capture?.redactions ?? []), faceSize: 512 });
    });

    it('λήψη που δεν είναι ready ⇒ not-ready (τη σαρώνει ο ψήστης) · ανιχνευτής που λείπει ⇒ error με όνομα, τίποτα γραμμένο', async () => {
      seedCapture();
      expect(await backfillFaceScan(db, captureRef(), true)).toEqual({ kind: 'not-ready' });
      seedCapture(READY(hash));
      expect(await withBrokenDetector(() => backfillFaceScan(db, captureRef(), true))).toMatchObject({ kind: 'error' });
      expect(await readCapture()).not.toHaveProperty('faceScan');
    });
  });
});

describe('Μ — ο κάδος μέσων (ADR-884 Φ2ζ ζ5)', () => {
  const setPlacement = (mediaPlacement: unknown) =>
    kit.seedCollection(TOURS, { [TOUR_ID]: { ...kit.getData(TOURS, TOUR_ID), mediaPlacement } });
  const tilesOf = (store: Map<string, StoredObject>) => [...store.keys()].filter((path) => path.startsWith(`tour-tiles/${TOUR_ID}/`));

  it('🔴 Μ1 — περιήγηση `tour-eu` ⇒ ΟΛΑ τα πλακίδια στον κάδο της ΕΕ, ΚΑΝΕΝΑ στον κανονικό · το πρωτότυπο διαβάζεται από τον κανονικό', async () => {
    setPlacement('tour-eu');
    seedCapture();
    expect(await bakeTourTileset(db, captureRef())).toEqual({ kind: 'baked', faceSize: 512, objects: 7, transition: 'written' });
    expect(tilesOf(euObjects)).toHaveLength(7);
    expect(tilesOf(objects)).toEqual([]);
    expect(objects.has(ORIGINAL_PATH)).toBe(true);
  });

  it('Μ2 — αποσυρμένα κλειδιά σβήνονται στον κάδο της ΘΕΣΗΣ (όχι στον άλλο)', async () => {
    setPlacement('tour-eu');
    euObjects.set(`tour-tiles/${TOUR_ID}/old_key/preview.jpg`, { bytes: Buffer.alloc(1), contentType: null });
    objects.set(`tour-tiles/${TOUR_ID}/old_key/preview.jpg`, { bytes: Buffer.alloc(1), contentType: null });
    seedCapture({ tileset: { state: 'pending', contentHash: hash, faceSize: null, retiredKeys: ['old_key'] } });
    await bakeTourTileset(db, captureRef());
    expect(euObjects.has(`tour-tiles/${TOUR_ID}/old_key/preview.jpg`)).toBe(false);
    expect(objects.has(`tour-tiles/${TOUR_ID}/old_key/preview.jpg`)).toBe(true);
  });

  it('🔴 Μ3 — ΑΓΝΩΣΤΗ θέση ⇒ deferred, κανένα πλακίδιο πουθενά (ποτέ «μαντεύω κάδο»)', async () => {
    setPlacement('mars');
    seedCapture();
    expect(await bakeTourTileset(db, captureRef())).toMatchObject({ kind: 'deferred' });
    expect([...tilesOf(euObjects), ...tilesOf(objects)]).toEqual([]);
    expect((await readCapture())?.tileset.state).toBe('pending');
  });
});
