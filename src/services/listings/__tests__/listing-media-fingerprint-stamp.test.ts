/**
 * @jest-environment node
 *
 * @fileoverview 🧬 **ΤΟ ΑΠΟΤΥΠΩΜΑ ΓΡΑΦΕΤΑΙ ΜΑΖΙ ΜΕ ΤΗΝ ΑΓΓΕΛΙΑ** — ADR-845 §7.17 Α5 (κλάση Ο-35).
 * @related services/listings/publish-public-listing-shelf.ts (`writeWithShelf`)
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: (1) το αποτύπωμα είναι αυτό που θα ξαναϋπολογίσει η συμφιλίωση από τα **ίδια**
 * μέσα — αλλιώς κάθε αγγελία «διαφέρει» κάθε βράδυ· (2) αγγελία της οποίας ράφι **απέτυχε** δεν
 * παίρνει αποτύπωμα — αλλιώς η συμφιλίωση που θα τη διόρθωνε τη βρίσκει «σύμφωνη».
 *
 * ⚠️ Mock μόνο τα τρία κεφάλια του ραφιού *(ίδιος λόγος με το `listing-shelf-withdrawal.test`)*.
 */

import type { DocumentReference } from 'firebase-admin/firestore';

import type { ListingMaterial } from '@/lib/listings/listing-material';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';
import type { PublicListing } from '@/types/public-listing';

jest.mock('server-only', () => ({}));

type ShelfReport = { outcome: 'reconciled' | 'failed'; published: never[]; removed: number; rejected: number };
const settled = (): ShelfReport => ({ outcome: 'reconciled', published: [], removed: 0, rejected: 0 });

const reconcilePublicShelf = jest.fn(async (..._args: unknown[]): Promise<ShelfReport> => settled());
const reconcilePublicModelShelf = jest.fn(async (..._args: unknown[]): Promise<ShelfReport> => settled());
const reconcilePublicVideoShelf = jest.fn(async (..._args: unknown[]): Promise<ShelfReport> => settled());

jest.mock('../public-shelf.service', () => ({
  reconcilePublicShelf: (...args: unknown[]) => reconcilePublicShelf(...args),
}));
jest.mock('../public-shelf-model.service', () => ({
  reconcilePublicModelShelf: (...args: unknown[]) => reconcilePublicModelShelf(...args),
}));
jest.mock('../public-shelf-video.service', () => ({
  reconcilePublicVideoShelf: (...args: unknown[]) => reconcilePublicVideoShelf(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { writeWithShelf } = require('../publish-public-listing-shelf') as
  typeof import('../publish-public-listing-shelf');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mediaFingerprintOf } = require('../listing-media-fingerprint-stamp') as
  typeof import('../listing-media-fingerprint-stamp');

const LISTING_ID = 'prop_95';
const LISTING = {
  id: LISTING_ID, authorship: 'agency', gallery: [], floorplans: [], models: [], videos: [],
} as unknown as PublicListing;

const SOURCES = [
  { privateStoragePath: 'companies/c/a.jpg', material: { kind: 'photo' }, sourceFileId: 'file_a', focalPoint: null },
] as unknown as readonly PublicShelfSource<ListingMaterial>[];

async function written(): Promise<Record<string, unknown>> {
  const set = jest.fn(async (_doc: Record<string, unknown>): Promise<void> => undefined);
  await writeWithShelf({ set } as unknown as DocumentReference, LISTING_ID, LISTING, SOURCES);
  return set.mock.calls[0][0];
}

beforeEach(() => jest.clearAllMocks());

describe('ADR-845 §7.17 Α5 — το αποτύπωμα δίπλα στο `schemaVersion`', () => {
  it('🏆 Στ1 — γράφεται στο ΙΔΙΟ `set`, και είναι αυτό που δίνουν τα ΙΔΙΑ μέσα', async () => {
    const doc = await written();

    expect(doc.mediaFingerprint).toBe(mediaFingerprintOf(SOURCES));
    expect(doc.mediaFingerprint).toMatch(/^v1:[0-9a-f]{64}$/);
    expect(typeof doc.schemaVersion).toBe('number');
  });

  it('🔒 Στ2 — ΚΑΝΕΝΑ ιδιωτικό μονοπάτι ή αναγνωριστικό αρχείου στο δημόσιο έγγραφο', async () => {
    const serialised = JSON.stringify(await written());

    expect(serialised).not.toContain('companies/c/a.jpg');
    expect(serialised).not.toContain('file_a');
  });

  it.each([
    ['εικόνων', reconcilePublicShelf],
    ['μοντέλων', reconcilePublicModelShelf],
    ['βίντεο', reconcilePublicVideoShelf],
  ])('🔴 Στ3 — το ράφι %s ΑΠΕΤΥΧΕ ⇒ ΚΑΝΕΝΑ αποτύπωμα («δεν ξέρω», όχι «συμφωνεί»)', async (_name, shelf) => {
    shelf.mockResolvedValueOnce({ ...settled(), outcome: 'failed' });

    const doc = await written();

    expect('mediaFingerprint' in doc).toBe(false);
    expect(typeof doc.schemaVersion).toBe('number');
  });
});
