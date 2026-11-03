/**
 * Ο γραφέας του ελέγχου προμηθευτή (ADR-923 §5.13 Ε1α · Ε1γ), πάνω στο ψεύτικο Firestore.
 * Το ΑΦΜ είναι συνθετικό: ποτέ πραγματικό ΑΦΜ φυσικού προσώπου σε test.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { CompanyTaxDeclarationRead } from '@/services/company/company-legal-identity';
import type { RegistryReportOutcome } from '@/services/company-registry/company-registry-verification.service';
import type { RegistryIdentityGap, RegistryIdentityReport } from '@/types/company-registry';
import {
  decideSupplierVerification,
  listSupplierReviews,
  readOwnSupplierReview,
  readSupplierStanding,
  readSupplierStandingOutcome,
  requestSupplierReview,
  revokeSupplierVerification,
  type SupplierReviewDeps,
} from '../supplier-review.server';

const recordChange = jest.fn(async () => 'audit-id');
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: (params: unknown) => recordChange(params as never) },
}));

const revalidateTag = jest.fn();
jest.mock('next/cache', () => ({ revalidateTag: (tag: string) => revalidateTag(tag) }));

const COMPANY = 'comp-a';
const COMPANY_TAG = 'public-catalog:company:comp-a';
const TAX_ID = '123456783';
const FINGERPRINT = 'fp-a';
const FILES = 'files';
const REVIEWS = 'supplier_verifications';
const T0 = '2026-11-01T10:00:00.000Z';

let fake: FakeFirestore;
let db: Firestore;

const PROFILE: CompanyTaxDeclarationRead = {
  kind: 'present',
  declaration: { entityType: null, businessName: 'ΑΛΦΑ ΑΕ', gemiNumber: '123456789000' },
  taxId: TAX_ID,
};

const reportWith = (gap: RegistryIdentityGap): RegistryReportOutcome => ({
  kind: 'report',
  report: { judgment: { state: 'declared', gap, check: null } } as unknown as RegistryIdentityReport,
});

function depsWith(overrides: Partial<SupplierReviewDeps> = {}): SupplierReviewDeps {
  return {
    readProfile: async () => PROFILE,
    readReport: async () => reportWith('not-checked'),
    registryConfigured: () => false,
    fingerprint: () => FINGERPRINT,
    ...overrides,
  };
}

const LIVE_FILE = {
  companyId: COMPANY,
  entityType: 'supplier_verification',
  entityId: COMPANY,
  status: 'ready',
  storagePath: 'x/y.pdf',
  contentType: 'application/pdf',
};

const request = (deps = depsWith(), evidenceFileId = 'file-1') =>
  requestSupplierReview(db, { companyId: COMPANY, actorUid: 'user-1', evidenceFileId, nowIso: T0 }, deps);

const decide = (decision: 'approve' | 'reject', deps = depsWith()) =>
  decideSupplierVerification(db, { companyId: COMPANY, reviewerUid: 'admin-1', decision, note: null, nowIso: T0 }, deps);

const stored = () => fake.getAllDocs(REVIEWS)[COMPANY];

beforeEach(() => {
  fake = new FakeFirestore();
  db = fake as unknown as Firestore;
  fake.seed(FILES, 'file-1', LIVE_FILE);
  recordChange.mockClear();
  revalidateTag.mockClear();
});

describe('requestSupplierReview', () => {
  it('χωρίς κλειδί ΓΕΜΗ ανοίγει η αίτηση με το έγγραφο', async () => {
    await expect(request()).resolves.toEqual({ kind: 'done', status: 'pending-review' });
    expect(stored()).toMatchObject({ companyId: COMPANY, status: 'pending-review', evidenceFileId: 'file-1' });
    expect(recordChange).toHaveBeenCalledTimes(1);
    expect(recordChange).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'supplier_verification',
        entityId: COMPANY,
        companyId: COMPANY,
        performedBy: 'user-1',
        changes: [{ field: 'status', oldValue: null, newValue: 'pending-review' }],
      }),
    );
  });

  it('🔒 το ΑΦΜ δεν φτάνει ούτε στο έγγραφο ούτε στο ιστορικό', async () => {
    await request();
    expect(JSON.stringify(stored())).not.toContain(TAX_ID);
    expect(JSON.stringify(recordChange.mock.calls)).not.toContain(TAX_ID);
    expect(JSON.stringify(recordChange.mock.calls)).not.toContain(FINGERPRINT);
  });

  it('με κλειδί ΓΕΜΗ η βλάβη του μητρώου δεν ανοίγει ουρά', async () => {
    await expect(request(depsWith({ registryConfigured: () => true }))).resolves.toEqual({ kind: 'refused', reason: 'route-closed' });
    expect(stored()).toBeUndefined();
  });

  it('κλεισμένη εταιρεία δεν ανοίγει αίτηση', async () => {
    await expect(request(depsWith({ readReport: async () => reportWith('inactive') }))).resolves.toEqual({
      kind: 'refused',
      reason: 'route-closed',
    });
  });

  it('το προφίλ δεν διαβάστηκε ⇒ καμία κρίση', async () => {
    await expect(request(depsWith({ readProfile: async () => ({ kind: 'unavailable' }) }))).resolves.toEqual({
      kind: 'refused',
      reason: 'profile-unavailable',
    });
    await expect(request(depsWith({ readReport: async () => ({ kind: 'profile-unavailable' }) }))).resolves.toEqual({
      kind: 'refused',
      reason: 'profile-unavailable',
    });
  });

  it.each<[string, CompanyTaxDeclarationRead]>([
    ['χωρίς προφίλ', { kind: 'absent' }],
    ['χωρίς ΑΦΜ', { ...PROFILE, taxId: null } as CompanyTaxDeclarationRead],
    ['άκυρο ΑΦΜ', { ...PROFILE, taxId: '123456789' } as CompanyTaxDeclarationRead],
    [
      'χωρίς επωνυμία',
      { kind: 'present', declaration: { entityType: null, businessName: null, gemiNumber: null }, taxId: TAX_ID },
    ],
  ])('%s ⇒ ελλιπής ταυτότητα', async (_name, profile) => {
    await expect(request(depsWith({ readProfile: async () => profile }))).resolves.toEqual({
      kind: 'refused',
      reason: 'identity-incomplete',
    });
  });

  it.each<[string, Record<string, unknown>]>([
    ['ξένου χώρου', { companyId: 'comp-b' }],
    ['άλλης οντότητας', { entityType: 'catalog_import_batch' }],
    ['άλλου ελέγχου', { entityId: 'comp-b' }],
    ['μη PDF', { contentType: 'image/png' }],
    ['ημιτελές', { status: 'pending' }],
  ])('έγγραφο %s ⇒ άρνηση', async (_name, overrides) => {
    fake.seed(FILES, 'file-2', { ...LIVE_FILE, ...overrides });
    await expect(request(depsWith(), 'file-2')).resolves.toEqual({ kind: 'refused', reason: 'evidence-refused' });
  });

  it('έγκριση που καλύπτει τα ίδια στοιχεία ⇒ άρνηση', async () => {
    await request();
    await decide('approve');
    await expect(request()).resolves.toEqual({ kind: 'refused', reason: 'already-approved' });
  });

  it('έγκριση που δεν καλύπτει πια τα στοιχεία ⇒ νέα αίτηση', async () => {
    await request();
    await decide('approve');
    await expect(request(depsWith({ fingerprint: () => 'fp-b' }))).resolves.toEqual({ kind: 'done', status: 'pending-review' });
  });
});

describe('decideSupplierVerification', () => {
  it('έγκριση ⇒ κρατά ό,τι υποβλήθηκε', async () => {
    await request();
    await expect(decide('approve')).resolves.toEqual({ kind: 'done', status: 'approved' });
    expect(stored()).toMatchObject({ status: 'approved', decidedBy: 'admin-1', approval: { taxFingerprint: FINGERPRINT } });
    expect(recordChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ performedBy: 'admin-1', changes: [{ field: 'status', oldValue: 'pending-review', newValue: 'approved' }] }),
    );
  });

  it('χωρίς αίτηση ⇒ άρνηση', async () => {
    await expect(decide('approve')).resolves.toEqual({ kind: 'refused', reason: 'not-found' });
  });

  it('τα στοιχεία άλλαξαν μετά την αίτηση ⇒ καμία έγκριση', async () => {
    await request();
    await expect(decide('approve', depsWith({ fingerprint: () => 'fp-b' }))).resolves.toEqual({ kind: 'refused', reason: 'facts-changed' });
    expect(stored()).toMatchObject({ status: 'pending-review' });
  });

  it('η εταιρεία έκλεισε μετά την αίτηση ⇒ καμία έγκριση', async () => {
    await request();
    await expect(decide('approve', depsWith({ readReport: async () => reportWith('inactive') }))).resolves.toEqual({
      kind: 'refused',
      reason: 'not-approvable',
    });
  });

  it('το προφίλ δεν διαβάστηκε ⇒ καμία έγκριση, η απόρριψη περνά', async () => {
    await request();
    const down = depsWith({ readProfile: async () => ({ kind: 'unavailable' }) });
    await expect(decide('approve', down)).resolves.toEqual({ kind: 'refused', reason: 'profile-unavailable' });
    await expect(decide('reject', down)).resolves.toEqual({ kind: 'done', status: 'rejected' });
  });

  it('δεύτερη απόφαση ⇒ άρνηση χωρίς νέο ίχνος', async () => {
    await request();
    await decide('reject');
    recordChange.mockClear();
    await expect(decide('reject')).resolves.toEqual({ kind: 'refused', reason: 'not-pending' });
    expect(recordChange).not.toHaveBeenCalled();
  });
});

describe('revokeSupplierVerification', () => {
  const revoke = () => revokeSupplierVerification(db, { companyId: COMPANY, reviewerUid: 'admin-2', note: 'πλαστό', nowIso: T0 });

  it('ανάκληση εγκεκριμένης', async () => {
    await request();
    await decide('approve');
    await expect(revoke()).resolves.toEqual({ kind: 'done', status: 'revoked' });
    expect(stored()).toMatchObject({ status: 'revoked', approval: null, decidedBy: 'admin-2' });
  });

  it('χωρίς εγγραφή ⇒ άρνηση', async () => {
    await expect(revoke()).resolves.toEqual({ kind: 'refused', reason: 'not-found' });
  });

  it('🔑 §4.5: η ανάκληση χτυπά το tag του χώρου', async () => {
    await request();
    await decide('approve');
    revalidateTag.mockClear();
    await revoke();
    expect(revalidateTag.mock.calls).toEqual([[COMPANY_TAG]]);
  });

  it('🔑 §4.5: το tag χτυπά και όταν το ίχνος ιστορικού αποτύχει', async () => {
    await request();
    await decide('approve');
    revalidateTag.mockClear();
    recordChange.mockRejectedValueOnce(new Error('audit 5xx'));
    await expect(revoke()).rejects.toThrow('audit 5xx');
    expect(revalidateTag).toHaveBeenCalledWith(COMPANY_TAG);
  });

  it('άρνηση ανάκλησης ⇒ κανένα tag', async () => {
    await revoke();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('η έγκριση δεν αγγίζει τη μνήμη της βιτρίνας: την ανοίγει μόνο η ρητή δημοσίευση', async () => {
    await request();
    await decide('approve');
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

describe('readSupplierStanding', () => {
  const standing = (deps = depsWith()) => readSupplierStanding(db, COMPANY, deps);
  const UNVERIFIED = { kind: 'unverified' };

  it('χωρίς αίτηση ⇒ ανεπιβεβαίωτος', async () => {
    await expect(standing()).resolves.toEqual(UNVERIFIED);
  });

  it('εκκρεμής ή απορριφθείσα αίτηση δεν δίνει σήμα', async () => {
    await request();
    await expect(standing()).resolves.toEqual(UNVERIFIED);
    await decide('reject');
    await expect(standing()).resolves.toEqual(UNVERIFIED);
  });

  it('έγκριση ⇒ επιβεβαιωμένος με χειροκίνητη βάση', async () => {
    await request();
    await decide('approve');
    await expect(standing()).resolves.toEqual({ kind: 'verified', basis: 'manual-review' });
  });

  it('ανάκληση ⇒ το σήμα πέφτει', async () => {
    await request();
    await decide('approve');
    await revokeSupplierVerification(db, { companyId: COMPANY, reviewerUid: 'admin-2', note: null, nowIso: T0 });
    await expect(standing()).resolves.toEqual(UNVERIFIED);
  });

  it('στιγμιότυπο σε μη εγκεκριμένη εγγραφή δεν μετρά', async () => {
    await request();
    await decide('approve');
    fake.seed(REVIEWS, COMPANY, { ...stored(), status: 'revoked' });
    await expect(standing()).resolves.toEqual(UNVERIFIED);
  });

  it('αλλαγή στοιχείων μετά την έγκριση ⇒ το σήμα πέφτει', async () => {
    await request();
    await decide('approve');
    await expect(standing(depsWith({ fingerprint: () => 'fp-b' }))).resolves.toEqual(UNVERIFIED);
  });

  it('το προφίλ δεν διαβάστηκε ⇒ κλειστό', async () => {
    await request();
    await decide('approve');
    await expect(standing(depsWith({ readProfile: async () => ({ kind: 'unavailable' }) }))).resolves.toEqual(UNVERIFIED);
  });

  it('λείπει το μυστικό ⇒ κλειστό, χωρίς να ρίξει', async () => {
    await request();
    await decide('approve');
    const noSecret = depsWith({
      fingerprint: () => {
        throw new Error('missing secret');
      },
    });
    await expect(standing(noSecret)).resolves.toEqual(UNVERIFIED);
  });
});

describe('readSupplierStandingOutcome — η βλάβη δεν είναι «χωρίς έγκριση»', () => {
  const outcome = (deps = depsWith()) => readSupplierStandingOutcome(db, COMPANY, deps);
  const missingSecret = () => {
    throw new Error('missing secret');
  };

  it('πραγματική απουσία έγκρισης ⇒ known unverified', async () => {
    await expect(outcome()).resolves.toEqual({ kind: 'known', standing: { kind: 'unverified' } });
  });

  it('απώλεια έγκρισης από ανάκληση ⇒ known unverified', async () => {
    await request();
    await decide('approve');
    await revokeSupplierVerification(db, { companyId: COMPANY, reviewerUid: 'admin-2', note: null, nowIso: T0 });
    await expect(outcome()).resolves.toEqual({ kind: 'known', standing: { kind: 'unverified' } });
  });

  it('έγκριση ⇒ known verified', async () => {
    await request();
    await decide('approve');
    await expect(outcome()).resolves.toEqual({ kind: 'known', standing: { kind: 'verified', basis: 'manual-review' } });
  });

  it.each<[string, Partial<SupplierReviewDeps>]>([
    ['το προφίλ δεν διαβάστηκε', { readProfile: async () => ({ kind: 'unavailable' }) }],
    ['η αναφορά δεν διαβάστηκε', { readReport: async () => ({ kind: 'profile-unavailable' }) }],
    ['λείπει το μυστικό', { fingerprint: missingSecret }],
    [
      'η ανάγνωση έριξε',
      {
        readReport: async () => {
          throw new Error('5xx');
        },
      },
    ],
  ])('%s ⇒ unknown, ποτέ known unverified', async (_name, overrides) => {
    await request();
    await decide('approve');
    await expect(outcome(depsWith(overrides))).resolves.toEqual({ kind: 'unknown' });
  });

  it('η ανάγνωση της εγγραφής έριξε ⇒ unknown', async () => {
    const broken = { collection: () => { throw new Error('5xx'); } } as unknown as Firestore;
    await expect(readSupplierStandingOutcome(broken, COMPANY, depsWith())).resolves.toEqual({ kind: 'unknown' });
  });
});

describe('readOwnSupplierReview', () => {
  const own = (deps = depsWith()) => readOwnSupplierReview(db, COMPANY, deps);

  it('χωρίς αίτηση ⇒ μπορεί να ζητήσει', async () => {
    await expect(own()).resolves.toEqual({
      status: null,
      routeKind: 'submit-document',
      canRequest: true,
      identityIncomplete: false,
      reviewNote: null,
      canPublish: false,
      published: false,
    });
  });

  it('ισχύουσα έγκριση ⇒ δεν ξαναζητά, μπορεί να δημοσιεύσει', async () => {
    await request();
    await decide('approve');
    await expect(own()).resolves.toMatchObject({ status: 'approved', canRequest: false, canPublish: true, published: false });
  });

  it('υπάρχουσα βιτρίνα ⇒ δεν ξαναδημοσιεύει', async () => {
    await request();
    await decide('approve');
    fake.seed('public_supplier_showcases', COMPANY, { companyId: COMPANY });
    await expect(own()).resolves.toMatchObject({ canPublish: false, published: true });
  });

  it('έγκριση που δεν καλύπτει πια τα στοιχεία ⇒ ξαναζητά', async () => {
    await request();
    await decide('approve');
    await expect(own(depsWith({ fingerprint: () => 'fp-b' }))).resolves.toMatchObject({ status: 'approved', canRequest: true });
  });

  it('απόρριψη ⇒ δείχνει τη σημείωση και ξαναζητά', async () => {
    await request();
    await decideSupplierVerification(db, { companyId: COMPANY, reviewerUid: 'admin-1', decision: 'reject', note: 'θολό', nowIso: T0 }, depsWith());
    await expect(own()).resolves.toMatchObject({ status: 'rejected', canRequest: true, reviewNote: 'θολό' });
  });

  it('ελλιπής ταυτότητα ⇒ δεν ζητά', async () => {
    await expect(own(depsWith({ readProfile: async () => ({ kind: 'absent' }) }))).resolves.toMatchObject({ canRequest: false, identityIncomplete: true });
  });

  it('🔑 ελλιπής ταυτότητα σε διαδρομή ελέγχου ⇒ το λέει ρητά, δεν μοιάζει με κλειστή εταιρεία', async () => {
    const deps = depsWith({ readProfile: async () => ({ kind: 'absent' }), readReport: async () => reportWith('no-registration-number') });
    await expect(own(deps)).resolves.toMatchObject({ routeKind: 'manual-review', canRequest: false, identityIncomplete: true });
  });

  it('κλεισμένη εταιρεία χωρίς ΑΦΜ ⇒ μένει κλειστή, όχι ελλιπής', async () => {
    const deps = depsWith({ readProfile: async () => ({ kind: 'absent' }), readReport: async () => reportWith('inactive') });
    await expect(own(deps)).resolves.toMatchObject({ routeKind: 'manual-review', canRequest: false, identityIncomplete: false });
  });

  it('κλειστή διαλογή ⇒ δεν ζητά', async () => {
    await expect(own(depsWith({ registryConfigured: () => true }))).resolves.toMatchObject({ routeKind: 'ask-registry', canRequest: false, identityIncomplete: false });
  });

  it('το προφίλ δεν διαβάστηκε ⇒ null', async () => {
    await expect(own(depsWith({ readProfile: async () => ({ kind: 'unavailable' }) }))).resolves.toBeNull();
  });

  it('🔒 η απάντηση δεν φέρει αποτύπωμα ΑΦΜ', async () => {
    await request();
    expect(JSON.stringify(await own())).not.toContain(FINGERPRINT);
  });
});

describe('listSupplierReviews', () => {
  it('🔒 η ουρά δεν δείχνει ποτέ αποτύπωμα ΑΦΜ', async () => {
    await request();
    const items = await listSupplierReviews(db, 'pending-review', depsWith());
    expect(items).toEqual([
      { companyId: COMPANY, legalName: 'ΑΛΦΑ ΑΕ', gemiNumber: '123456789000', evidenceFileId: 'file-1', approvable: true, createdAt: T0 },
    ]);
    expect(JSON.stringify(items)).not.toContain(FINGERPRINT);
  });

  it('κλεισμένη εταιρεία ή αλλαγμένα στοιχεία ⇒ χωρίς έγκριση', async () => {
    await request();
    const [closed] = await listSupplierReviews(db, 'pending-review', depsWith({ readReport: async () => reportWith('inactive') }));
    const [changed] = await listSupplierReviews(db, 'pending-review', depsWith({ fingerprint: () => 'fp-b' }));
    expect(closed?.approvable).toBe(false);
    expect(changed?.approvable).toBe(false);
  });

  it('οι εγκεκριμένες βγαίνουν στη δική τους λίστα, για ανάκληση', async () => {
    await request();
    await decide('approve');
    const items = await listSupplierReviews(db, 'approved', depsWith());
    expect(items.map((item) => item.companyId)).toEqual([COMPANY]);
  });

  it('μόνο οι εκκρεμείς', async () => {
    await request();
    await decide('reject');
    await expect(listSupplierReviews(db, 'pending-review', depsWith())).resolves.toEqual([]);
  });
});
