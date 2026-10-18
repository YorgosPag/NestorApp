/**
 * @jest-environment node
 *
 * @fileoverview **«Συμπλήρωση στοιχείων» — η πράξη** (ADR-915 §33).
 * @related services/document-registry/facts-declaration.service.ts
 *
 * ⚠️ Ο κριτής, ο κατάλογος θέσεων και ο ΕΝΑΣ γραφέας τρέχουν **αληθινά** πάνω σε `FakeFirestore`· πλάθεται μόνο το
 * ημερολόγιο αρχείων (εκτός θέματος). Όλα τα δεδομένα είναι **συνθετικά**.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ENTITY_TYPES, FILE_STATUS } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

jest.mock('server-only', () => ({}));
const mockRecordFileAudit = jest.fn(async () => 'audit_1');
jest.mock('@/services/file-audit-admin.service', () => ({
  recordFileAudit: (...args: unknown[]) => mockRecordFileAudit(...(args as [])),
}));

import { declareDocumentFacts } from '../facts-declaration.service';

const COMPANY = 'comp_alfa';
const ACTOR = { companyId: COMPANY, uid: 'user_1' };
const PATH = 'companies/comp_alfa/yde-a1.pdf';

type Doc = Record<string, unknown>;

const yde = (over: Doc = {}): Doc => ({
  companyId: COMPANY, entityType: ENTITY_TYPES.PROPERTY, entityId: 'prop_1', purpose: 'yde-declaration',
  status: FILE_STATUS.READY, isDeleted: false, storagePath: PATH, updatedAt: 'u0', revision: 2, ...over,
});

const body = (over: Doc = {}) => ({
  fileId: 'file_y', kind: 'electrical-installation' as const, issuedOn: '2022-03-01', printedValidUntil: '2032-03-01',
  classification: 'A', storagePath: PATH, ...over,
});

let fake: FakeFirestore;
const db = (): AdminFirestore => fake as unknown as AdminFirestore;
const stored = async (): Promise<Doc | undefined> => (await fake.collection(COLLECTIONS.FILES).doc('file_y').get()).data();

beforeEach(() => {
  fake = new FakeFirestore();
  mockRecordFileAudit.mockClear();
});

describe('η δήλωση γράφεται ΜΟΝΟ από τον ΕΝΑ γραφέα', () => {
  it('ΥΔΕ χωρίς στοιχεία ⇒ `changed`, γεγονότα `attested:registry-declaration` από τον άνθρωπο, ΚΑΝΕΝΑ updatedAt/revision', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_y', yde());
    await expect(declareDocumentFacts(db(), ACTOR, body())).resolves.toEqual({ ok: true, outcome: 'changed' });
    const data = await stored();
    expect(data?.documentFacts).toMatchObject({
      kind: 'electrical-installation', issuedOn: '2022-03-01', printedValidUntil: '2032-03-01', classification: 'A',
      source: { kind: 'attested', via: 'registry-declaration' }, recordedBy: 'user_1',
    });
    expect([data?.updatedAt, data?.revision]).toEqual(['u0', 2]);
    expect(mockRecordFileAudit).toHaveBeenCalledTimes(1);
  });

  it('ίδια στοιχεία ξανά ⇒ `unchanged`, κανένα δεύτερο ίχνος (ιδεμπότητα)', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_y', yde());
    await declareDocumentFacts(db(), ACTOR, body());
    await expect(declareDocumentFacts(db(), { ...ACTOR, uid: 'user_2' }, body())).resolves.toEqual({ ok: true, outcome: 'unchanged' });
    expect(mockRecordFileAudit).toHaveBeenCalledTimes(1);
  });
});

describe('αρνήσεις με όνομα', () => {
  it.each([
    ['ξένη εταιρεία', yde({ companyId: 'comp_beta' })],
    ['στον κάδο', yde({ isDeleted: true })],
    ['μη έτοιμο', yde({ status: 'pending' })],
  ])('⛔ %s ⇒ `absent` (ξένο ≡ ανύπαρκτο), τίποτα δεν γράφεται', async (_label, data) => {
    fake.seed(COLLECTIONS.FILES, 'file_y', data);
    await expect(declareDocumentFacts(db(), ACTOR, body())).resolves.toEqual({ ok: false, refusal: 'absent' });
    expect((await stored())?.documentFacts).toBeUndefined();
  });

  it('⛔ ανύπαρκτο αρχείο ⇒ `absent`', async () => {
    await expect(declareDocumentFacts(db(), ACTOR, body())).resolves.toEqual({ ok: false, refusal: 'absent' });
  });

  it('⛔ είδος που η θέση ΔΕΝ φιλοξενεί (ΥΔΕ δηλωμένη ως «φορολογική») ⇒ `kind-not-promised`', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_y', yde());
    const asTax = body({ kind: 'tax-clearance', classification: null, printedValidUntil: '2022-05-01' });
    await expect(declareDocumentFacts(db(), ACTOR, asTax)).resolves.toEqual({ ok: false, refusal: 'kind-not-promised' });
  });

  it('⛔ ΥΔΕ στην ΕΠΑΦΗ (αρχείο του ηλεκτρολόγου) ⇒ `kind-not-promised` — δεν παρακολουθείται', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_y', yde({ entityType: ENTITY_TYPES.CONTACT, entityId: 'cont_e' }));
    await expect(declareDocumentFacts(db(), ACTOR, body())).resolves.toEqual({ ok: false, refusal: 'kind-not-promised' });
  });

  it('⛔ ο κριτής: λήξη πριν από έκδοση ⇒ `validity-before-issue`, τίποτα δεν γράφεται', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_y', yde());
    await expect(declareDocumentFacts(db(), ACTOR, body({ printedValidUntil: '2021-01-01' })))
      .resolves.toEqual({ ok: false, refusal: 'validity-before-issue' });
    expect((await stored())?.documentFacts).toBeUndefined();
  });

  it('⛔ CAS: νέα έκδοση του αρχείου στο μεταξύ ⇒ `not-this-object`, ποτέ ημερομηνίες του παλιού πάνω στο νέο', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_y', yde({ storagePath: 'companies/comp_alfa/yde-a1-v2.pdf' }));
    await expect(declareDocumentFacts(db(), ACTOR, body())).resolves.toEqual({ ok: false, refusal: 'not-this-object' });
  });

  it('⛔ ΕΓΚΡΙΣΗ ελεγκτή μεταβίβασης ήδη στο αρχείο ⇒ `outranked`, η έγκριση μένει ανέπαφη', async () => {
    const reviewed = {
      kind: 'electrical-installation', issuedOn: '2020-01-01', printedValidUntil: null, classification: null,
      source: { kind: 'attested', via: 'conveyance-review' }, recordedBy: 'reviewer', recordedAt: '2026-10-01T00:00:00.000Z',
    };
    fake.seed(COLLECTIONS.FILES, 'file_y', yde({ documentFacts: reviewed }));
    await expect(declareDocumentFacts(db(), ACTOR, body())).resolves.toEqual({ ok: false, refusal: 'outranked' });
    expect((await stored())?.documentFacts).toEqual(reviewed);
  });
});
