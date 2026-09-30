/**
 * Άγκυρες του κάδου μέσων της περιήγησης (ADR-884 Φ2ζ ζ5 · §12 Δ11): ο καθαρός κριτής απόκλισης, η ιδεμπότητη προμήθεια και ο
 * ΕΝΑΣ επιλογέας κάδου. Κανένα δίκτυο — ο κάδος είναι ψεύτικος και κρατά μόνο τα μεταδεδομένα του.
 */
jest.mock('server-only', () => ({}));

const calls: string[] = [];
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminBucket: () => ({ name: 'default-bucket' }),
  getTourMediaBucket: () => ({ name: 'tour-media-bucket' }),
}));

import type { Bucket, BucketMetadata } from '@google-cloud/storage';

import { GCS_TOUR_MEDIA_BUCKET_CONFIG as CONFIG } from '@/config/gcs-buckets';

import { ensureTourMediaBucket, inspectTourMediaBucket, TOUR_MEDIA_BUCKET_FIELDS, tourMediaDrift } from '../tour-media-provision';
import { tourMediaBucket } from '../tour-media-store';

/** Ο κάδος ακριβώς όπως τον δηλώνει ο κώδικας — με τη μορφή που τον επιστρέφει η GCS (συμβολοσειρές, άλλη σειρά κλειδιών). */
function declaredAsReturned(): BucketMetadata {
  return {
    location: 'EUROPE-WEST3',
    storageClass: 'STANDARD',
    iamConfiguration: { publicAccessPrevention: 'enforced', uniformBucketLevelAccess: { enabled: true } },
    softDeletePolicy: { retentionDurationSeconds: '0' },
    lifecycle: { rule: [{ condition: { matchesPrefix: ['tour-ingest/'], age: 1 }, action: { type: 'Delete' } }] },
    cors: [{ maxAgeSeconds: 3600, responseHeader: [...CONFIG.cors.responseHeader], method: ['PUT'], origin: [...CONFIG.cors.origin] }],
  };
}

function fakeBucket(initial: BucketMetadata | null): Bucket & { metadata: BucketMetadata | null } {
  const bucket = {
    metadata: initial,
    exists: async () => [bucket.metadata !== null],
    getMetadata: async () => [bucket.metadata],
    create: async (request: BucketMetadata) => { calls.push('create'); bucket.metadata = { ...request, softDeletePolicy: { retentionDurationSeconds: '0' } }; },
    setMetadata: async (patch: BucketMetadata) => { calls.push('setMetadata'); bucket.metadata = { ...bucket.metadata, ...patch }; },
  };
  return bucket as unknown as Bucket & { metadata: BucketMetadata | null };
}

beforeEach(() => { calls.length = 0; });

describe('Κ — ο κριτής απόκλισης', () => {
  it('Κ1 — ο δηλωμένος κάδος, όπως τον επιστρέφει η GCS ⇒ ΚΑΜΙΑ απόκλιση (σειρά κλειδιών / «0» ως κείμενο δεν μετρούν)', () => {
    expect(tourMediaDrift(declaredAsReturned())).toEqual([]);
  });

  it('🔴 Κ2 — soft delete ΑΠΟΝ = η προεπιλογή των 7 ημερών ⇒ απόκλιση (τα αποσυρμένα πλακίδια θα ήταν ανακτήσιμα)', () => {
    const { softDeletePolicy: _absent, ...rest } = declaredAsReturned();
    expect(tourMediaDrift(rest)).toEqual(['soft-delete']);
    expect(tourMediaDrift({ ...rest, softDeletePolicy: { retentionDurationSeconds: '604800' } })).toEqual(['soft-delete']);
  });

  it('🔴 Κ3 — CORS με `*` ⇒ απόκλιση (ιδιωτικός κάδος: μόνο τα origins της εφαρμογής)', () => {
    const cors = [{ ...declaredAsReturned().cors![0], origin: ['*'] }];
    expect(tourMediaDrift({ ...declaredAsReturned(), cors })).toEqual(['cors']);
  });

  it('🔴 Κ4 — δημόσια πρόσβαση όχι «enforced» · ξένος κανόνας κύκλου ζωής · άλλη περιοχή ⇒ κάθε ένα ονομάζεται', () => {
    const actual = declaredAsReturned();
    expect(tourMediaDrift({ ...actual, iamConfiguration: { ...actual.iamConfiguration, publicAccessPrevention: 'inherited' } }))
      .toEqual(['public-access-prevention']);
    const foreign = { rule: [...actual.lifecycle!.rule!, { action: { type: 'Delete' }, condition: { age: 30 } }] };
    expect(tourMediaDrift({ ...actual, lifecycle: foreign })).toEqual(['ingest-lifecycle']);
    expect(tourMediaDrift({ ...actual, location: 'US-EAST1' })).toEqual(['location']);
  });

  it('Κ5 — η δήλωση: Φρανκφούρτη · ποτέ `*` · μόνο PUT · καραντίνα 1 ημέρας · soft delete 0', () => {
    expect(CONFIG).toMatchObject({ location: 'EUROPE-WEST3', publicAccessPrevention: 'enforced', softDeleteRetentionSeconds: 0, ingestTtlDays: 1 });
    expect(CONFIG.cors.origin).not.toContain('*');
    expect(CONFIG.cors.method).toEqual(['PUT']);
  });
});

describe('Π — η προμήθεια', () => {
  it('Π1 — κάδος που λείπει ⇒ ΜΙΑ δημιουργία με ΟΛΗ τη δήλωση ⇒ καμία απόκλιση', async () => {
    const bucket = fakeBucket(null);
    expect(await inspectTourMediaBucket(bucket)).toMatchObject({ exists: false, drift: [...TOUR_MEDIA_BUCKET_FIELDS] });
    expect(await ensureTourMediaBucket(bucket)).toMatchObject({ exists: true, drift: [] });
    expect(calls).toEqual(['create']);
  });

  it('🏆 Π2 — ιδεμπότητη: κάδος ήδη σωστός ⇒ ΚΑΝΕΝΑ αίτημα εγγραφής', async () => {
    const bucket = fakeBucket(declaredAsReturned());
    expect(await ensureTourMediaBucket(bucket)).toMatchObject({ drift: [] });
    expect(calls).toEqual([]);
  });

  it('Π3 — αλλαγή στην κονσόλα (CORS `*`) ⇒ ΜΙΑ συμφιλίωση ⇒ ξανά όπως γράφει ο κώδικας', async () => {
    const bucket = fakeBucket({ ...declaredAsReturned(), cors: [{ origin: ['*'], method: ['GET'] }] });
    expect(await ensureTourMediaBucket(bucket)).toMatchObject({ drift: [] });
    expect(calls).toEqual(['setMetadata']);
  });

  it('🔴 Π4 — λάθος περιοχή ΔΕΝ «διορθώνεται» (η GCS δεν τη μετακινεί) — αναφέρεται, χωρίς εγγραφή', async () => {
    const bucket = fakeBucket({ ...declaredAsReturned(), location: 'US-EAST1' });
    expect(await ensureTourMediaBucket(bucket)).toMatchObject({ drift: ['location'] });
    expect(calls).toEqual([]);
  });
});

describe('Ε — ο ΕΝΑΣ επιλογέας κάδου', () => {
  it('`tour-eu` ⇒ κάδος μέσων · `legacy-default` / απόν ⇒ ο κανονικός (έγγραφα πριν το ζ5)', () => {
    expect(tourMediaBucket('tour-eu')).toEqual({ name: 'tour-media-bucket' });
    expect(tourMediaBucket('legacy-default')).toEqual({ name: 'default-bucket' });
    expect(tourMediaBucket(undefined)).toEqual({ name: 'default-bucket' });
  });
});
