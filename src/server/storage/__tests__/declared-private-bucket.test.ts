/**
 * Άγκυρες του ΕΝΑ μηχανισμού ιδιωτικών κάδων (ADR-895 Α5 · γενίκευση του ADR-884 Φ2ζ ζ5): ο καθαρός κριτής απόκλισης και η
 * ιδεμπότητη προμήθεια, **για κάθε δηλωμένο κάδο** του πραγματικού μητρώου. Κανένα δίκτυο — ο κάδος είναι ψεύτικος.
 */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({
  getTourMediaBucket: () => ({ name: 'tour-media-bucket' }),
  getFilesEuBucket: () => ({ name: 'files-eu-bucket' }),
}));

import type { Bucket, BucketMetadata } from '@google-cloud/storage';

import { APP_UPLOAD_CORS, GCS_FILES_EU_BUCKET_CONFIG, GCS_TOUR_MEDIA_BUCKET_CONFIG } from '@/config/gcs-buckets';
import { FILES_EU_BUCKET_LOCATION } from '@/lib/files/file-storage-placement';

import {
  type DeclaredPrivateBucket,
  ensurePrivateBucket,
  inspectPrivateBucket,
  PRIVATE_BUCKET_FIELDS,
  privateBucketDrift,
} from '../declared-private-bucket';
import { DECLARED_PRIVATE_BUCKETS, declaredPrivateBucket } from '../private-bucket-registry';

const calls: string[] = [];
const TOUR = declaredPrivateBucket('tour-media') as DeclaredPrivateBucket;
const FILES_EU = declaredPrivateBucket('files-eu') as DeclaredPrivateBucket;

/** Ο κάδος ακριβώς όπως τον δηλώνει ο κώδικας — με τη μορφή που τον επιστρέφει η GCS (συμβολοσειρές, άλλη σειρά κλειδιών). */
function declaredAsReturned(decl: DeclaredPrivateBucket): BucketMetadata {
  const rules = decl.lifecycleRules.map((rule) => ({ condition: { ...rule.condition }, action: { ...rule.action } }));
  return {
    location: decl.location,
    storageClass: decl.storageClass,
    iamConfiguration: { publicAccessPrevention: 'enforced', uniformBucketLevelAccess: { enabled: true } },
    softDeletePolicy: { retentionDurationSeconds: String(decl.softDeleteRetentionSeconds) },
    // Η GCS παραλείπει εντελώς το πεδίο όταν δεν υπάρχει κανόνας.
    ...(rules.length > 0 ? { lifecycle: { rule: rules } } : {}),
    cors: [{ maxAgeSeconds: 3600, responseHeader: [...decl.cors.responseHeader], method: ['PUT'], origin: [...decl.cors.origin] }],
  };
}

/** Ψεύτικος κάδος: η GCS «δημιουργεί» με τη δική της σειρά/μορφή· `lifecycle: null` = αφαίρεση κανόνων. */
function fakeBucket(decl: DeclaredPrivateBucket, initial: BucketMetadata | null): Bucket & { metadata: BucketMetadata | null } {
  const bucket = {
    metadata: initial,
    exists: async () => [bucket.metadata !== null],
    getMetadata: async () => [bucket.metadata],
    create: async () => { calls.push('create'); bucket.metadata = declaredAsReturned(decl); },
    setMetadata: async (patch: BucketMetadata) => {
      calls.push('setMetadata');
      const { lifecycle, ...rest } = { ...bucket.metadata, ...patch };
      bucket.metadata = lifecycle === null ? rest : { ...rest, lifecycle };
    },
  };
  return bucket as unknown as Bucket & { metadata: BucketMetadata | null };
}

beforeEach(() => { calls.length = 0; });

describe.each(DECLARED_PRIVATE_BUCKETS.map((decl) => [decl.id, decl] as const))('Κ — ο κριτής απόκλισης · %s', (_id, decl) => {
  it('Κ1 — ο δηλωμένος κάδος, όπως τον επιστρέφει η GCS ⇒ ΚΑΜΙΑ απόκλιση', () => {
    expect(privateBucketDrift(decl, declaredAsReturned(decl))).toEqual([]);
  });

  it('🔴 Κ2 — soft delete ΑΠΟΝ ή άλλη διάρκεια ⇒ απόκλιση', () => {
    const { softDeletePolicy: _absent, ...rest } = declaredAsReturned(decl);
    expect(privateBucketDrift(decl, rest)).toEqual(['soft-delete']);
    expect(privateBucketDrift(decl, { ...rest, softDeletePolicy: { retentionDurationSeconds: '1209600' } })).toEqual(['soft-delete']);
  });

  it('🔴 Κ3 — CORS με `*` ⇒ απόκλιση (ιδιωτικός κάδος: μόνο τα origins της εφαρμογής)', () => {
    const cors = [{ ...declaredAsReturned(decl).cors![0], origin: ['*'] }];
    expect(privateBucketDrift(decl, { ...declaredAsReturned(decl), cors })).toEqual(['cors']);
  });

  it('🔴 Κ4 — PAP όχι «enforced» · ξένος κανόνας κύκλου ζωής · άλλη περιοχή · versioning ⇒ κάθε ένα ονομάζεται', () => {
    const actual = declaredAsReturned(decl);
    expect(privateBucketDrift(decl, { ...actual, iamConfiguration: { ...actual.iamConfiguration, publicAccessPrevention: 'inherited' } }))
      .toEqual(['public-access-prevention']);
    const foreign = { rule: [...(actual.lifecycle?.rule ?? []), { action: { type: 'Delete' }, condition: { age: 30 } }] };
    expect(privateBucketDrift(decl, { ...actual, lifecycle: foreign })).toEqual(['lifecycle']);
    expect(privateBucketDrift(decl, { ...actual, location: 'US-EAST1' })).toEqual(['location']);
    expect(privateBucketDrift(decl, { ...actual, versioning: { enabled: true } })).toEqual(['versioning']);
  });

  it('🔴 Κ5 — hierarchical namespace (σπάει τα holds) · object retention (μη αναστρέψιμο) ⇒ απόκλιση', () => {
    const actual = declaredAsReturned(decl);
    expect(privateBucketDrift(decl, { ...actual, hierarchicalNamespace: { enabled: true } })).toEqual(['hierarchical-namespace']);
    expect(privateBucketDrift(decl, { ...actual, objectRetention: { mode: 'Enabled' } })).toEqual(['object-retention']);
  });
});

describe('Δ — οι δηλώσεις', () => {
  it('Δ1 — μέσα περιήγησης: Φρανκφούρτη · soft delete 0 · καραντίνα 1 ημέρας μόνο στο `tour-ingest/`', () => {
    expect(TOUR).toMatchObject({ location: 'EUROPE-WEST3', softDeleteRetentionSeconds: 0 });
    expect(TOUR.lifecycleRules).toEqual([{ action: { type: 'Delete' }, condition: { age: GCS_TOUR_MEDIA_BUCKET_CONFIG.ingestTtlDays, matchesPrefix: ['tour-ingest/'] } }]);
  });

  it('🔴 Δ2 — πρωτότυπα ΕΕ: Φρανκφούρτη · soft delete 7 ημέρες (Ε3) · ΚΑΝΕΝΑΣ κύκλος ζωής (ένα πρωτότυπο δεν λήγει)', () => {
    expect(FILES_EU).toMatchObject({ location: 'EUROPE-WEST3', storageClass: 'STANDARD', softDeleteRetentionSeconds: 604_800, lifecycleRules: [] });
    expect(GCS_FILES_EU_BUCKET_CONFIG.softDeleteRetentionSeconds).toBe(7 * 24 * 3600);
  });

  it('🏆 Δ3 — ΕΝΑ CORS για όλους: ποτέ `*` · μόνο PUT · το ίδιο αντικείμενο (όχι δεύτερη λίστα origins)', () => {
    expect(APP_UPLOAD_CORS.origin).not.toContain('*');
    expect(APP_UPLOAD_CORS.method).toEqual(['PUT']);
    for (const decl of DECLARED_PRIVATE_BUCKETS) expect(decl.cors).toBe(APP_UPLOAD_CORS);
  });

  it('🔴 Δ5 — η περιοχή του κάδου ΕΕ ΕΙΝΑΙ η σταθερά του leaf που διαβάζουν και οι gen2 triggers (ADR-895 Φ2)', () => {
    // Eventarc: trigger στην ΙΔΙΑ περιοχή με τον κάδο. Δήλωση και Functions διαβάζουν ΜΙΑ σταθερά (προβολή).
    expect(GCS_FILES_EU_BUCKET_CONFIG.location).toBe(FILES_EU_BUCKET_LOCATION);
    expect(FILES_EU.location).toBe(FILES_EU_BUCKET_LOCATION);
  });

  it('Δ4 — μοναδικά ids · άγνωστο id ⇒ undefined (ποτέ «ο πρώτος»)', () => {
    const ids = DECLARED_PRIVATE_BUCKETS.map((decl) => decl.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(declaredPrivateBucket('public-shelf')).toBeUndefined();
  });
});

describe.each(DECLARED_PRIVATE_BUCKETS.map((decl) => [decl.id, decl] as const))('Π — η προμήθεια · %s', (_id, decl) => {
  it('Π1 — κάδος που λείπει ⇒ ΜΙΑ δημιουργία ⇒ καμία απόκλιση', async () => {
    const bucket = fakeBucket(decl, null);
    expect(await inspectPrivateBucket(decl, bucket)).toMatchObject({ exists: false, drift: [...PRIVATE_BUCKET_FIELDS] });
    expect(await ensurePrivateBucket(decl, bucket)).toMatchObject({ exists: true, drift: [] });
    expect(calls).toEqual(['create']);
  });

  it('🏆 Π2 — ιδεμπότητη: κάδος ήδη σωστός ⇒ ΚΑΝΕΝΑ αίτημα εγγραφής', async () => {
    const bucket = fakeBucket(decl, declaredAsReturned(decl));
    expect(await ensurePrivateBucket(decl, bucket)).toMatchObject({ drift: [] });
    expect(calls).toEqual([]);
  });

  it('Π3 — αλλαγή στην κονσόλα (CORS `*` + ξένος κανόνας + versioning) ⇒ ΜΙΑ συμφιλίωση ⇒ ξανά όπως ο κώδικας', async () => {
    const bucket = fakeBucket(decl, {
      ...declaredAsReturned(decl),
      cors: [{ origin: ['*'], method: ['GET'] }],
      lifecycle: { rule: [{ action: { type: 'Delete' }, condition: { age: 30 } }] },
      versioning: { enabled: true },
    });
    expect(await ensurePrivateBucket(decl, bucket)).toMatchObject({ drift: [] });
    expect(calls).toEqual(['setMetadata']);
  });

  it('🔴 Π4 — περιοχή / HNS / object retention ΔΕΝ «διορθώνονται» — αναφέρονται, χωρίς εγγραφή', async () => {
    const bucket = fakeBucket(decl, {
      ...declaredAsReturned(decl), location: 'US-EAST1', hierarchicalNamespace: { enabled: true }, objectRetention: { mode: 'Enabled' },
    });
    expect(await ensurePrivateBucket(decl, bucket)).toMatchObject({ drift: ['location', 'hierarchical-namespace', 'object-retention'] });
    expect(calls).toEqual([]);
  });
});

describe('Γ — το αίτημα γέννησης', () => {
  it('🔴 Γ1 — ΟΛΗ η δήλωση σε ΕΝΑ αίτημα: HNS κλειστό · χωρίς object retention · χωρίς versioning · κανένας κύκλος ζωής στον files-eu', async () => {
    const created: BucketMetadata[] = [];
    const probe = fakeBucket(FILES_EU, null);
    probe.create = (async (request: BucketMetadata) => { created.push(request); probe.metadata = declaredAsReturned(FILES_EU); }) as unknown as Bucket['create'];
    await ensurePrivateBucket(FILES_EU, probe);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      location: 'EUROPE-WEST3',
      hierarchicalNamespace: { enabled: false },
      enableObjectRetention: false,
      versioning: { enabled: false },
      iamConfiguration: { publicAccessPrevention: 'enforced', uniformBucketLevelAccess: { enabled: true } },
      softDeletePolicy: { retentionDurationSeconds: 604_800 },
    });
    expect(created[0]).not.toHaveProperty('lifecycle');
  });
});
