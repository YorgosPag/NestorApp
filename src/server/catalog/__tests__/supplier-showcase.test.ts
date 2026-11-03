/**
 * Ο γραφέας της βιτρίνας προμηθευτή (ADR-923 §5.13 Δ6), πάνω στο ψεύτικο Firestore. Το ΑΦΜ είναι συνθετικό.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { CompanyTaxDeclarationRead } from '@/services/company/company-legal-identity';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { RegistryIdentityReport } from '@/types/company-registry';
import { decideSupplierVerification, requestSupplierReview, type SupplierReviewDeps } from '../supplier-review.server';
import { publishSupplierShowcase, refreshSupplierShowcaseStanding } from '../supplier-showcase.server';

const recordChange = jest.fn(async () => 'audit-id');
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: (params: unknown) => recordChange(params as never) },
}));

const revalidateTag = jest.fn();
jest.mock('next/cache', () => ({ revalidateTag: (tag: string) => revalidateTag(tag) }));

const COMPANY = 'comp-a';
const COMPANY_TAG = 'public-catalog:company:comp-a';
const SHOWCASES = 'public_supplier_showcases';
const T0 = '2026-11-01T10:00:00.000Z';
const TAX_ID = '123456783';

let fake: FakeFirestore;
let db: Firestore;

const profileNamed = (businessName: string): CompanyTaxDeclarationRead => ({
  kind: 'present',
  declaration: { entityType: null, businessName, gemiNumber: '123456789000' },
  taxId: TAX_ID,
});

function depsWith(overrides: Partial<SupplierReviewDeps> = {}): SupplierReviewDeps {
  return {
    readProfile: async () => profileNamed('ΑΛΦΑ ΑΕ'),
    readReport: async () => ({
      kind: 'report',
      report: { judgment: { state: 'declared', gap: 'not-checked', check: null } } as unknown as RegistryIdentityReport,
    }),
    registryConfigured: () => false,
    fingerprint: () => 'fp-a',
    ...overrides,
  };
}

const stored = () => fake.getAllDocs(SHOWCASES)[COMPANY];
const refresh = (deps = depsWith()) => refreshSupplierShowcaseStanding(db, COMPANY, 'actor-1', deps);
const publish = (deps = depsWith()) => publishSupplierShowcase(db, COMPANY, 'actor-1', deps);

async function approve(): Promise<void> {
  await requestSupplierReview(db, { companyId: COMPANY, actorUid: 'user-1', evidenceFileId: 'file-1', nowIso: T0 }, depsWith());
  await decideSupplierVerification(db, { companyId: COMPANY, reviewerUid: 'admin-1', decision: 'approve', note: null, nowIso: T0 }, depsWith());
}

beforeEach(() => {
  fake = new FakeFirestore();
  db = fake as unknown as Firestore;
  fake.seed('files', 'file-1', {
    companyId: COMPANY,
    entityType: 'supplier_verification',
    entityId: COMPANY,
    status: 'ready',
    storagePath: 'x/y.pdf',
    contentType: 'application/pdf',
  });
  recordChange.mockClear();
  revalidateTag.mockClear();
});

describe('§4.5: το tag του χώρου', () => {
  async function published(): Promise<void> {
    await approve();
    await publish();
    revalidateTag.mockClear();
  }

  it('🔑 η δημοσίευση το χτυπά: καμία αποθηκευμένη σελίδα «δεν βρέθηκε»', async () => {
    await approve();
    await publish();
    expect(revalidateTag.mock.calls).toEqual([[COMPANY_TAG]]);
  });

  it('άρνηση δημοσίευσης ⇒ κανένα tag', async () => {
    await publish();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('🔑 η απόσυρση το χτυπά', async () => {
    await published();
    await refresh(depsWith({ fingerprint: () => 'fp-b' }));
    expect(revalidateTag.mock.calls).toEqual([[COMPANY_TAG]]);
  });

  it('🔑 αλλαγή στοιχείων το χτυπά', async () => {
    await published();
    fake.seed(SHOWCASES, COMPANY, { ...stored(), legalName: 'ΠΑΛΙΑ ΑΕ' });
    await expect(refresh()).resolves.toBe('updated');
    expect(revalidateTag.mock.calls).toEqual([[COMPANY_TAG]]);
  });

  it('🔑 αποτυχία ιστορικού μετά την απόσυρση δεν κρατά ζωντανή τη σελίδα', async () => {
    await published();
    recordChange.mockRejectedValueOnce(new Error('audit 5xx'));
    await expect(refresh(depsWith({ fingerprint: () => 'fp-b' }))).resolves.toBe('failed');
    expect(stored()).toBeUndefined();
    expect(revalidateTag).toHaveBeenCalledWith(COMPANY_TAG);
  });

  it('ίδια στοιχεία, βλάβη ή αδημοσίευτη βιτρίνα ⇒ κανένα tag', async () => {
    await refresh();
    await published();
    await refresh();
    await refresh(depsWith({ readProfile: async () => ({ kind: 'unavailable' }) }));
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

describe('publishSupplierShowcase', () => {
  it('επιβεβαιωμένος ⇒ δημοσιεύεται με ίχνος', async () => {
    await approve();
    await expect(publish()).resolves.toEqual({ kind: 'published' });
    expect(stored()).toMatchObject({ companyId: COMPANY, legalName: 'ΑΛΦΑ ΑΕ', basis: 'manual-review' });
    expect(recordChange).toHaveBeenLastCalledWith(expect.objectContaining({ changes: [{ field: 'showcase', oldValue: false, newValue: true }] }));
  });

  it('🔒 το έγγραφο έχει μόνο τα πέντε πεδία, χωρίς ΑΦΜ ή ποσό', async () => {
    await approve();
    await publish();
    expect(Object.keys(stored() ?? {}).sort()).toEqual(['basis', 'companyId', 'legalName', 'publishedAt', 'updatedAt']);
  });

  it('ανεπιβεβαίωτος ⇒ άρνηση', async () => {
    await expect(publish()).resolves.toEqual({ kind: 'refused', reason: 'not-verified' });
    expect(stored()).toBeUndefined();
  });

  it('βλάβη ⇒ άρνηση χωρίς εγγραφή', async () => {
    await approve();
    await expect(publish(depsWith({ readProfile: async () => ({ kind: 'unavailable' }) }))).resolves.toEqual({ kind: 'refused', reason: 'unavailable' });
    expect(stored()).toBeUndefined();
  });

  it('δεύτερη δημοσίευση κρατά την αρχική ημερομηνία', async () => {
    await approve();
    await publish();
    fake.seed(SHOWCASES, COMPANY, { ...stored(), publishedAt: T0 });
    await publish();
    expect(stored()).toMatchObject({ publishedAt: T0 });
  });
});

describe('refreshSupplierShowcaseStanding', () => {
  it('🔑 χωρίς δημοσίευση δεν δημιουργεί ποτέ βιτρίνα, ακόμη και για επιβεβαιωμένο', async () => {
    await approve();
    await expect(refresh()).resolves.toBe('not-published');
    expect(stored()).toBeUndefined();
  });

  it('ίδια στοιχεία ⇒ καμία εγγραφή', async () => {
    await approve();
    await publish();
    const before = stored();
    await expect(refresh()).resolves.toBe('current');
    expect(stored()).toEqual(before);
  });

  it('🔑 βλάβη ανάγνωσης ή λείπον μυστικό δεν αποσύρουν', async () => {
    await approve();
    await publish();
    await expect(refresh(depsWith({ readProfile: async () => ({ kind: 'unavailable' }) }))).resolves.toBe('unknown');
    const noSecret = depsWith({
      fingerprint: () => {
        throw new Error('missing secret');
      },
    });
    await expect(refresh(noSecret)).resolves.toBe('unknown');
    expect(stored()).toBeDefined();
  });

  it('βέβαιη απώλεια επιβεβαίωσης ⇒ απόσυρση με ίχνος', async () => {
    await approve();
    await publish();
    recordChange.mockClear();
    await expect(refresh(depsWith({ fingerprint: () => 'fp-b' }))).resolves.toBe('withdrawn');
    expect(stored()).toBeUndefined();
    expect(recordChange).toHaveBeenCalledWith(expect.objectContaining({ changes: [{ field: 'showcase', oldValue: true, newValue: false }] }));
  });

  it('🔒 χαλασμένο έγγραφο ⇒ αποσύρεται αν χάθηκε η επιβεβαίωση, αλλιώς μένει ως έχει', async () => {
    await approve();
    await publish();
    fake.seed(SHOWCASES, COMPANY, { companyId: COMPANY, legalName: 'ΧΑΛΑΣΜΕΝΟ' });
    await expect(refresh()).resolves.toBe('failed');
    expect(stored()).toMatchObject({ legalName: 'ΧΑΛΑΣΜΕΝΟ' });
    await expect(refresh(depsWith({ fingerprint: () => 'fp-b' }))).resolves.toBe('withdrawn');
    expect(stored()).toBeUndefined();
  });

  it('αποτυχία εγγραφής δεν ρίχνει τη μετονομασία', async () => {
    const broken = { collection: () => { throw new Error('5xx'); } } as unknown as Firestore;
    await expect(refreshSupplierShowcaseStanding(broken, COMPANY, 'actor-1', depsWith())).resolves.toBe('failed');
  });
});
