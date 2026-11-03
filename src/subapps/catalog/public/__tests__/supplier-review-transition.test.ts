import {
  decideSupplierReview,
  revokeSupplierApproval,
  submitSupplierReview,
  type SupplierReviewDecision,
  type SupplierReviewSubmission,
  type SupplierReviewTransition,
} from '@/subapps/catalog/public/supplier-review-transition';
import type { SupplierIdentityFacts, SupplierReviewRecord } from '@/subapps/catalog/types/supplier-verification';

const FACTS: SupplierIdentityFacts = { legalName: 'ΑΛΦΑ ΑΕ', gemiNumber: '123456789000', taxFingerprint: 'fp-a' };
const OTHER_FACTS: SupplierIdentityFacts = { ...FACTS, legalName: 'ΒΗΤΑ ΑΕ' };
const T0 = '2026-11-01T10:00:00.000Z';
const T1 = '2026-11-02T10:00:00.000Z';

const submission = (overrides: Partial<SupplierReviewSubmission> = {}): SupplierReviewSubmission => ({
  companyId: 'comp-a',
  submitted: FACTS,
  taxBinding: null,
  evidenceFileId: 'file-1',
  nowIso: T0,
  approvalStillCovers: false,
  ...overrides,
});

const decision = (overrides: Partial<SupplierReviewDecision> = {}): SupplierReviewDecision => ({
  decision: 'approve',
  reviewerUid: 'admin-1',
  note: null,
  nowIso: T1,
  approvable: true,
  ...overrides,
});

function recordOf(transition: SupplierReviewTransition): SupplierReviewRecord {
  if (transition.kind !== 'next') throw new Error(`refused: ${transition.reason}`);
  return transition.record;
}

const pending = (): SupplierReviewRecord => recordOf(submitSupplierReview(null, submission()));
const approved = (): SupplierReviewRecord => recordOf(decideSupplierReview(pending(), decision()));
const rejected = (): SupplierReviewRecord => recordOf(decideSupplierReview(pending(), decision({ decision: 'reject' })));

describe('submitSupplierReview', () => {
  it('πρώτη αίτηση ⇒ εκκρεμής, χωρίς απόφαση και χωρίς έγκριση', () => {
    expect(pending()).toEqual({
      companyId: 'comp-a',
      status: 'pending-review',
      submitted: FACTS,
      taxBinding: null,
      evidenceFileId: 'file-1',
      approval: null,
      createdAt: T0,
      updatedAt: T0,
      decidedAt: null,
      decidedBy: null,
      reviewNote: null,
    });
  });

  it('ανανέωση εκκρεμούς ⇒ κρατά τη θέση στην ουρά, αλλάζει το έγγραφο', () => {
    const renewed = recordOf(submitSupplierReview(pending(), submission({ evidenceFileId: 'file-2', nowIso: T1 })));
    expect(renewed).toMatchObject({ createdAt: T0, updatedAt: T1, evidenceFileId: 'file-2' });
  });

  it('έγκριση που ισχύει ⇒ άρνηση', () => {
    expect(submitSupplierReview(approved(), submission({ approvalStillCovers: true }))).toEqual({
      kind: 'refused',
      reason: 'already-approved',
    });
  });

  it('έγκριση που έπαψε να ισχύει ⇒ νέα αίτηση, νέα θέση, χωρίς την παλιά έγκριση', () => {
    const renewed = recordOf(submitSupplierReview(approved(), submission({ submitted: OTHER_FACTS, nowIso: T1 })));
    expect(renewed).toMatchObject({ status: 'pending-review', approval: null, decidedAt: null, decidedBy: null, createdAt: T1 });
  });

  it('μετά από απόρριψη ⇒ νέα θέση και καθαρή σημείωση', () => {
    const decided = recordOf(decideSupplierReview(pending(), decision({ decision: 'reject', note: 'θολό' })));
    const renewed = recordOf(submitSupplierReview(decided, submission({ nowIso: T1 })));
    expect(renewed).toMatchObject({ status: 'pending-review', createdAt: T1, reviewNote: null });
  });

  it('το `approvalStillCovers` δεν εμποδίζει αίτηση που δεν είναι εγκεκριμένη', () => {
    expect(submitSupplierReview(rejected(), submission({ approvalStillCovers: true })).kind).toBe('next');
  });
});

describe('decideSupplierReview', () => {
  it('έγκριση ⇒ κρατά ό,τι είδε ο διαχειριστής, με ίχνος', () => {
    expect(recordOf(decideSupplierReview(pending(), decision({ note: 'εντάξει' })))).toMatchObject({
      status: 'approved',
      approval: FACTS,
      decidedAt: T1,
      updatedAt: T1,
      decidedBy: 'admin-1',
      reviewNote: 'εντάξει',
      createdAt: T0,
    });
  });

  it('απόρριψη ⇒ χωρίς στιγμιότυπο', () => {
    expect(rejected()).toMatchObject({ status: 'rejected', approval: null, decidedBy: 'admin-1' });
  });

  it('μη εγκρίσιμη υπόθεση ⇒ άρνηση έγκρισης', () => {
    expect(decideSupplierReview(pending(), decision({ approvable: false }))).toEqual({
      kind: 'refused',
      reason: 'not-approvable',
    });
  });

  it('μη εγκρίσιμη υπόθεση ⇒ η απόρριψη περνά', () => {
    expect(decideSupplierReview(pending(), decision({ decision: 'reject', approvable: false })).kind).toBe('next');
  });

  it.each([
    ['approved', approved],
    ['rejected', rejected],
  ])('κατάσταση %s ⇒ δεύτερη απόφαση απορρίπτεται', (_name, record) => {
    expect(decideSupplierReview(record(), decision())).toEqual({ kind: 'refused', reason: 'not-pending' });
  });
});

describe('revokeSupplierApproval', () => {
  const revocation = { reviewerUid: 'admin-2', note: 'πλαστό', nowIso: T1 };

  it('έγκριση ⇒ ανάκληση που σβήνει το στιγμιότυπο', () => {
    expect(recordOf(revokeSupplierApproval(approved(), revocation))).toMatchObject({
      status: 'revoked',
      approval: null,
      updatedAt: T1,
      decidedAt: T1,
      decidedBy: 'admin-2',
      reviewNote: 'πλαστό',
    });
  });

  it.each([
    ['pending-review', pending],
    ['rejected', rejected],
  ])('κατάσταση %s ⇒ άρνηση', (_name, record) => {
    expect(revokeSupplierApproval(record(), revocation)).toEqual({ kind: 'refused', reason: 'not-approved' });
  });
});
