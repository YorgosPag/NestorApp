/**
 * ΑΓΚΥΡΕΣ ΤΗΣ ΜΕΤΑΒΑΣΗΣ ΜΕΣΩΝ ΣΤΗΝ ΕΕ — ADR-884 Φ2ζ ζ5 · §12 Δ11.
 *
 * Δύο ψεύτικοι κάδοι (US legacy · EU) με crc32c ανά αντικείμενο και μια ψεύτικη περιήγηση με λήψεις.
 * Σ manifest · Μ μετάβαση · Κ καθαρισμός. 🔴 = κανόνας που, αν σπάσει, σερβίρει 404 ή κρυμμένο pixel.
 */

jest.mock('server-only', () => ({}));

interface FakeObject { crc32c: string; size: number }
type FakeStore = Map<string, FakeObject>;

const us: FakeStore = new Map();
const eu: FakeStore = new Map();
let copyHook: (name: string) => void = () => undefined;

function fakeBucket(store: FakeStore, name: string) {
  const file = (path: string) => ({
    name: path,
    get metadata() { return store.get(path) ?? {}; },
    copy: async (dest: { name: string; store: FakeStore }) => {
      const object = store.get(path);
      if (object) dest.store.set(dest.name, { ...object });
      copyHook(path);
    },
    store,
  });
  return {
    name,
    file,
    getFiles: async ({ prefix }: { prefix: string }) => [[...store.keys()].filter((key) => key.startsWith(prefix)).map(file)],
    deleteFiles: async ({ prefix }: { prefix: string }) => { for (const key of [...store.keys()]) if (key.startsWith(prefix)) store.delete(key); },
  };
}

const usBucket = fakeBucket(us, 'us');
const euBucket = fakeBucket(eu, 'eu');
jest.mock('../tour-media-store', () => ({
  effectiveMediaPlacement: (placement: string | undefined) => placement ?? 'legacy-default',
  tourMediaBucket: (placement: string | undefined) => ((placement ?? 'legacy-default') === 'tour-eu' ? euBucket : usBucket),
}));
jest.mock('@/lib/spatial-tour/spatial-tour-from-document', () => ({
  spatialTourFromDocument: (raw: unknown) => raw,
  tourCaptureFromDocument: (raw: unknown) => raw,
}));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }) }));

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { cleanupLegacyTourMedia, migrateTourMedia, tourMediaManifest } from '../tour-media-migration';
import type { SpatialTour, TourCapture } from '@/types/spatial-tour';

const TOUR_ID = 'stour_a';
const ROOT = `tour-tiles/${TOUR_ID}`;

let tourDoc: Record<string, unknown>;
let captures: Array<Record<string, unknown>>;

const capture = (id: string, state: string, key: string | null, faceSize: number | null = 1536, retiredKeys?: string[]) =>
  ({ id, tileset: { state, contentHash: key, faceSize, ...(retiredKeys ? { retiredKeys } : {}) } });

const tourRef = {
  id: TOUR_ID,
  get: async () => ({ exists: true, data: () => tourDoc }),
  collection: () => ({ get: async () => ({ docs: captures.map((c) => ({ id: c.id, data: () => c })) }), __captures: true }),
} as unknown as DocumentReference;

const db = {
  runTransaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({
    get: async (target: { __captures?: boolean }) => (target.__captures ? tourRef.collection('x').get() : tourRef.get()),
    update: (_ref: unknown, patch: Record<string, unknown>) => { tourDoc = { ...tourDoc, ...patch }; },
  }),
} as unknown as Firestore;

function seedUs(key: string, n: number): void {
  for (let i = 0; i < n; i += 1) us.set(`${ROOT}/${key}/r1/l0/px/0_${i}.jpg`, { crc32c: `${key}-${i}`, size: 100 });
}

beforeEach(() => {
  us.clear(); eu.clear(); copyHook = () => undefined;
  tourDoc = { id: TOUR_ID, levels: [{ floorPlans: [{ image: { contentHash: 'plan1' } }, { image: null }] }] };
  captures = [capture('tcap_1', 'ready', 'k1', 1536, ['old']), capture('tcap_2', 'ready', 'k2'), capture('tcap_old', 'ready', 'k0', null)];
  seedUs('k1', 3); seedUs('k2', 2);
  us.set(`${ROOT}/plans/plan1/p1/w800.webp`, { crc32c: 'p', size: 50 });
  us.set(`${ROOT}/old/r1/preview.jpg`, { crc32c: 'retired', size: 10 });
});

describe('Σ — manifest: μόνο τα ΖΩΝΤΑΝΑ', () => {
  it('🔴 Σ1 — ready κλειδιά + κατόψεις· ΠΟΤΕ αποσυρμένα· παλιά διάταξη αναφέρεται χωριστά', () => {
    expect(tourMediaManifest(tourDoc as unknown as SpatialTour, captures as unknown as TourCapture[]))
      .toEqual({ tileKeys: ['k1', 'k2'], planHashes: ['plan1'], unservable: ['tcap_old'] });
  });
  it('🔴 Σ2 — λήψη pending ⇒ null (ο ψήστης δουλεύει)', () => {
    expect(tourMediaManifest(tourDoc as unknown as SpatialTour, [...captures, capture('tcap_3', 'pending', 'k3')] as unknown as TourCapture[])).toBeNull();
  });
});

describe('Μ — μετάβαση', () => {
  it('Μ1 — ξηρό: μετρά, ΔΕΝ γράφει τίποτα', async () => {
    await expect(migrateTourMedia(db, tourRef, false)).resolves.toMatchObject({ kind: 'planned', objects: 6, bytes: 550, copied: 6 });
    expect(eu.size).toBe(0);
    expect(tourDoc.mediaPlacement).toBeUndefined();
  });

  it('Μ2 — apply: ζωντανά στον EU, CAS θέσης, το αποσυρμένο ΜΕΝΕΙ έξω, ο US ανέπαφος', async () => {
    await expect(migrateTourMedia(db, tourRef, true)).resolves.toMatchObject({ kind: 'migrated', objects: 6, copied: 6 });
    expect([...eu.keys()].some((key) => key.includes('/old/'))).toBe(false);
    expect(eu.size).toBe(6);
    expect(us.size).toBe(7);
    expect(tourDoc).toMatchObject({ mediaPlacement: 'tour-eu' });
    expect(typeof tourDoc.mediaPlacementChangedAt).toBe('string');
  });

  it('Μ3 — ιδεμπότητο: ό,τι υπάρχει ήδη πανομοιότυπο δεν ξαναγράφεται', async () => {
    eu.set(`${ROOT}/k1/r1/l0/px/0_0.jpg`, { crc32c: 'k1-0', size: 100 });
    await expect(migrateTourMedia(db, tourRef, false)).resolves.toMatchObject({ copied: 5 });
  });

  it('🔴 Μ4 — αντίγραφο με ΑΛΛΟ crc32c = λείπει (ποτέ «υπάρχει όνομα, άρα εντάξει»)', async () => {
    eu.set(`${ROOT}/k1/r1/l0/px/0_0.jpg`, { crc32c: 'corrupt', size: 100 });
    await expect(migrateTourMedia(db, tourRef, false)).resolves.toMatchObject({ copied: 6 });
  });

  it('🔴 Μ5 — pending ⇒ busy, τίποτα δεν αντιγράφεται ούτε αλλάζει θέση', async () => {
    captures.push(capture('tcap_3', 'pending', 'k3'));
    await expect(migrateTourMedia(db, tourRef, true)).resolves.toEqual({ kind: 'skipped', reason: 'busy' });
    expect(eu.size).toBe(0);
  });

  it('🔴 Μ6 — η αντιγραφή δεν έφτασε ⇒ άρνηση parity, ΚΑΝΕΝΑ flip', async () => {
    copyHook = (name) => { if (name.endsWith('0_1.jpg')) eu.delete(name); };
    await expect(migrateTourMedia(db, tourRef, true)).resolves.toMatchObject({ kind: 'refused', reason: 'parity' });
    expect(tourDoc.mediaPlacement).toBeUndefined();
  });

  it('🔴 Μ7 — ξεκίνησε ψήσιμο ΑΝΑΜΕΣΑ σε αντιγραφή και CAS ⇒ άρνηση changed, ΚΑΝΕΝΑ flip', async () => {
    copyHook = () => { if (!captures.some((c) => c.id === 'tcap_3')) captures.push(capture('tcap_3', 'pending', 'k3')); };
    await expect(migrateTourMedia(db, tourRef, true)).resolves.toMatchObject({ kind: 'refused', reason: 'changed' });
    expect(tourDoc.mediaPlacement).toBeUndefined();
  });

  it('Μ8 — ήδη στην ΕΕ ⇒ παράλειψη', async () => {
    tourDoc.mediaPlacement = 'tour-eu';
    await expect(migrateTourMedia(db, tourRef, true)).resolves.toEqual({ kind: 'skipped', reason: 'already-eu' });
  });
});

describe('Κ — καθαρισμός του παλιού κάδου', () => {
  const T0 = Date.parse('2026-09-30T10:00:00.000Z');

  it('Κ1 — δεν μετακινήθηκε ⇒ δεν αγγίζει τίποτα', async () => {
    await expect(cleanupLegacyTourMedia(tourRef, T0)).resolves.toEqual({ kind: 'skipped', reason: 'not-migrated' });
    expect(us.size).toBe(7);
  });

  it('🔴 Κ2 — πριν λήξουν τα κουπόνια (15′) ⇒ grace, ο US μένει', async () => {
    await migrateTourMedia(db, tourRef, true);
    const changedAt = Date.parse(tourDoc.mediaPlacementChangedAt as string);
    await expect(cleanupLegacyTourMedia(tourRef, changedAt + 14 * 60_000)).resolves.toEqual({ kind: 'skipped', reason: 'grace' });
    expect(us.size).toBe(7);
  });

  it('🔴 Κ3 — λείπει αντικείμενο στον EU ⇒ άρνηση, ο US μένει', async () => {
    await migrateTourMedia(db, tourRef, true);
    eu.delete(`${ROOT}/k2/r1/l0/px/0_1.jpg`);
    const later = Date.parse(tourDoc.mediaPlacementChangedAt as string) + 16 * 60_000;
    await expect(cleanupLegacyTourMedia(tourRef, later)).resolves.toMatchObject({ kind: 'refused', reason: 'parity' });
    expect(us.size).toBe(7);
  });

  it('Κ4 — μετά τα 15′ με ισοτιμία ⇒ σβήνει ΟΛΟ το πρόθεμα στον US (και τα αποσυρμένα)', async () => {
    await migrateTourMedia(db, tourRef, true);
    const later = Date.parse(tourDoc.mediaPlacementChangedAt as string) + 16 * 60_000;
    await expect(cleanupLegacyTourMedia(tourRef, later)).resolves.toEqual({ kind: 'cleaned', deleted: 7 });
    expect(us.size).toBe(0);
    expect(eu.size).toBe(6);
  });
});
