/**
 * ΑΓΚΥΡΕΣ ΤΟΥ ΔΙΧΤΥΟΥ ΑΠΟΚΛΙΣΗΣ ΚΑΔΩΝ — ADR-884 Φ2ζ ζ5 (πρότυπο ADR-851).
 *
 * Κ1 καθαροί κάδοι ⇒ σιωπή · Κ2 απόκλιση ⇒ Sentry με όνομα κάδου και πεδία · Κ3 ανύπαρκτος κάδος = απόκλιση, όχι αποτυχία ·
 * 🔴 Κ4 «δεν μπορέσαμε να κρίνουμε» ⇒ ΠΕΤΑ (χτυπά ο monitor) · Δ δημόσιο ράφι: δύο ερωτήσεις (IAM ≠ CORS) ·
 * 🏆 Κ5 οι ιδιωτικοί κάδοι έρχονται από το ΠΡΑΓΜΑΤΙΚΟ μητρώο (ADR-895 Α5) — ο `files-eu` επιτηρείται χωρίς δεύτερη λίστα.
 */

import type { PublicShelfBucketState } from '@/services/listings/public-shelf-provision';

/** Ο ελεγκτής ιδιωτικού κάδου — απαντά ανά `id` της δήλωσης (το μητρώο είναι το ΑΛΗΘΙΝΟ). */
const inspectPrivate = jest.fn();
const inspectPublicShelfBucket = jest.fn();
const sentryCaptureMessage = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getTourMediaBucket: () => ({}), getFilesEuBucket: () => ({}) }));
jest.mock('@/server/storage/declared-private-bucket', () => ({
  inspectPrivateBucket: (decl: { readonly id: string }) => inspectPrivate(decl.id),
}));
jest.mock('@/services/listings/public-shelf-provision', () => ({ inspectPublicShelfBucket: () => inspectPublicShelfBucket() }));
jest.mock('@/lib/telemetry', () => ({ sentryCaptureMessage: (...args: unknown[]) => sentryCaptureMessage(...args) }));

import { publicShelfDrift, runStorageBucketDrift } from '../storage-bucket-drift.job';

const CLEAN_SHELF: PublicShelfBucketState = {
  bucketName: 'p-public-media',
  exists: true,
  location: 'EUROPE-WEST1',
  uniformAccess: true,
  publiclyReadable: true,
  browserReadable: true,
};
const CLEAN_TOUR = { bucketName: 'p-tour-media', exists: true, drift: [] };
const CLEAN_FILES_EU = { bucketName: 'p-files-eu', exists: true, drift: [] };

beforeEach(() => {
  jest.clearAllMocks();
  inspectPrivate.mockImplementation(async (id: string) => (id === 'tour-media' ? CLEAN_TOUR : CLEAN_FILES_EU));
  inspectPublicShelfBucket.mockResolvedValue(CLEAN_SHELF);
});

describe('storage-bucket-drift', () => {
  it('Κ1 — όλοι όπως η δήλωση ⇒ κανένα Sentry, drifted 0', async () => {
    const result = await runStorageBucketDrift();
    expect(sentryCaptureMessage).not.toHaveBeenCalled();
    expect(result.metrics).toMatchObject({ buckets: 3, drifted: 0, 'drift_tour-media': 0, 'drift_files-eu': 0, 'drift_public-shelf': 0 });
  });

  it('Κ2 — απόκλιση ⇒ Sentry warning με ΟΝΟΜΑ κάδου και ΠΕΔΙΑ', async () => {
    inspectPrivate.mockImplementation(async (id: string) => (id === 'tour-media' ? { ...CLEAN_TOUR, drift: ['soft-delete', 'cors'] } : CLEAN_FILES_EU));
    const result = await runStorageBucketDrift();
    expect(sentryCaptureMessage).toHaveBeenCalledWith('Storage bucket drifted from git', 'warning', expect.objectContaining({
      extra: { drifted: [{ name: 'tour-media', bucketName: 'p-tour-media', exists: true, drift: ['soft-delete', 'cors'] }] },
    }));
    expect(result.summary).toContain('tour-media: soft-delete,cors');
  });

  it('Κ3 — κάδος που ΛΕΙΠΕΙ = εύρημα, όχι αποτυχία εργασίας', async () => {
    inspectPublicShelfBucket.mockResolvedValue({ ...CLEAN_SHELF, exists: false });
    await expect(runStorageBucketDrift()).resolves.toMatchObject({ metrics: { drifted: 1 } });
    expect(sentryCaptureMessage).toHaveBeenCalledTimes(1);
  });

  it('🔴 Κ4 — σφάλμα GCS ⇒ η εργασία ΠΕΤΑ (ποτέ σιωπηλό «καθαρό»)', async () => {
    inspectPrivate.mockRejectedValue(new Error('403 storage.buckets.get'));
    await expect(runStorageBucketDrift()).rejects.toThrow('403');
    expect(sentryCaptureMessage).not.toHaveBeenCalled();
  });

  it('🏆 Κ5 — ο κάδος πρωτοτύπων ΕΕ που δεν γεννήθηκε ακόμη ⇒ εύρημα με το ΔΙΚΟ του όνομα (ήρθε από το μητρώο)', async () => {
    inspectPrivate.mockImplementation(async (id: string) => (id === 'files-eu' ? { ...CLEAN_FILES_EU, exists: false, drift: ['location'] } : CLEAN_TOUR));
    const result = await runStorageBucketDrift();
    expect(inspectPrivate.mock.calls.map(([id]) => id)).toEqual(['tour-media', 'files-eu']);
    expect(result.summary).toContain('files-eu: location');
  });
});

describe('publicShelfDrift — το ράφι ΠΑΡΑΤΗΡΕΙΤΑΙ, εδώ ΚΡΙΝΕΤΑΙ', () => {
  it('Δ1 — καθαρό ⇒ []', () => expect(publicShelfDrift(CLEAN_SHELF)).toEqual([]));
  it('Δ2 — λείπει ⇒ μόνο «exists»', () => expect(publicShelfDrift({ ...CLEAN_SHELF, exists: false })).toEqual(['exists']));
  it('🔴 Δ3 — δημόσιο με curl αλλά ΑΟΡΑΤΟ στον browser (Ο-21) ⇒ «cors»', () => {
    expect(publicShelfDrift({ ...CLEAN_SHELF, browserReadable: false })).toEqual(['cors']);
  });
  it('Δ4 — λάθος περιοχή + χωρίς δημόσια ανάγνωση ⇒ και τα δύο', () => {
    expect(publicShelfDrift({ ...CLEAN_SHELF, location: 'us-east1', publiclyReadable: false })).toEqual(['location', 'public-read']);
  });
});
