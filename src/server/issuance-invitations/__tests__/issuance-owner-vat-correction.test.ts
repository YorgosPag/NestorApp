/**
 * ADR-915 §45.15 (1β-γ-2) — **«Εφαρμογή στην επαφή»**: γράφεται ΜΟΝΟ η διόρθωση που υπάρχει στο τεκμήριο (CAS) — ποτέ
 * ελεύθερο ΑΦΜ· ίδιο ΑΦΜ ⇒ `unchanged` χωρίς εγγραφή· ξένη επαφή ⇒ άρνηση· κάθε εγγραφή από τον ΕΝΑ γραφέα (ίχνος ADR-195).
 */

import type { Firestore } from 'firebase-admin/firestore';

import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';
import { updateContactField } from '@/services/ai-pipeline/shared/contact-lookup-crud';

import { applyOwnerVatCorrection } from '../issuance-owner-vat-correction';
import { readOwnAssignment } from '../issuance-space-invite';

jest.mock('server-only', () => ({}));
jest.mock('../issuance-space-invite', () => ({ readOwnAssignment: jest.fn() }));
jest.mock('@/server/lib/owned-contact-docs', () => ({ readOwnedContactDocs: jest.fn() }));
jest.mock('@/services/ai-pipeline/shared/contact-lookup-crud', () => ({ updateContactField: jest.fn(async () => undefined) }));
jest.mock('@/services/document-registry/issuance-assignment-schema', () => ({
  issuanceRecordOf: (assignment: { readonly record: unknown }) => assignment.record,
}));

const readAssignment = readOwnAssignment as jest.MockedFunction<typeof readOwnAssignment>;
const readContacts = readOwnedContactDocs as jest.MockedFunction<typeof readOwnedContactDocs>;
const write = updateContactField as jest.MockedFunction<typeof updateContactField>;

const DB = {} as Firestore;
const ACTOR = { companyId: 'comp_1', uid: 'uid_agent' };
const TARGET = { propertyId: 'prop_1', documentKind: 'energy-certificate', contactId: 'cont_co', vatNumber: '998 877 666' } as const;

/** Τεκμήριο: ο συνιδιοκτήτης διορθώθηκε, ο ίδιος επιβεβαιώθηκε. */
function withAttestation(): void {
  readAssignment.mockResolvedValue({
    record: {
      decision: {
        ownerAttestation: {
          owners: [
            { contactId: 'cont_self', verdict: 'confirmed', vatNumber: '090000045' },
            { contactId: 'cont_co', verdict: 'corrected', vatNumber: '998877666' },
          ],
          missingNote: null,
        },
      },
    },
  } as unknown as Awaited<ReturnType<typeof readOwnAssignment>>);
}

beforeEach(() => jest.clearAllMocks());

describe('ADR-915 §45.15 — applyOwnerVatCorrection', () => {
  it('η διόρθωση του τεκμηρίου ⇒ ΕΝΑ γράψιμο από τον ΕΝΑ γραφέα, κανονικοποιημένο, με τον χρήστη ως performer', async () => {
    withAttestation();
    readContacts.mockResolvedValue(new Map([['cont_co', { vatNumber: '111111111' }]]));
    expect(await applyOwnerVatCorrection(DB, ACTOR, TARGET)).toEqual({ ok: true, result: 'applied' });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('cont_co', 'vatNumber', '998877666', expect.objectContaining({ kind: 'user', uid: 'uid_agent' }));
    expect(readContacts).toHaveBeenCalledWith(DB, 'comp_1', ['cont_co']);
  });

  it('η επαφή έχει ήδη το ΑΦΜ ⇒ `unchanged`, ΚΑΜΙΑ εγγραφή (ιδεμποτία εκ κατασκευής)', async () => {
    withAttestation();
    readContacts.mockResolvedValue(new Map([['cont_co', { vatNumber: '998877666' }]]));
    expect(await applyOwnerVatCorrection(DB, ACTOR, TARGET)).toEqual({ ok: true, result: 'unchanged' });
    expect(write).not.toHaveBeenCalled();
  });

  it.each([
    ['άλλο ΑΦΜ από το τεκμήριο (ελεύθερη τιμή)', { ...TARGET, vatNumber: '123456783' }],
    ['επαφή που μόνο επιβεβαιώθηκε', { ...TARGET, contactId: 'cont_self', vatNumber: '090000045' }],
    ['επαφή εκτός τεκμηρίου', { ...TARGET, contactId: 'cont_other' }],
  ])('🔴 %s ⇒ `no-correction`, τίποτα δεν διαβάζεται ή γράφεται στην επαφή', async (_label, target) => {
    withAttestation();
    expect(await applyOwnerVatCorrection(DB, ACTOR, target)).toEqual({ ok: false, refusal: 'no-correction' });
    expect(readContacts).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('καμία ανάθεση ⇒ `absent` · ξένη επαφή ⇒ `contact-unavailable` — καμία εγγραφή', async () => {
    readAssignment.mockResolvedValue(null);
    expect(await applyOwnerVatCorrection(DB, ACTOR, TARGET)).toEqual({ ok: false, refusal: 'absent' });
    withAttestation();
    readContacts.mockResolvedValue(new Map());
    expect(await applyOwnerVatCorrection(DB, ACTOR, TARGET)).toEqual({ ok: false, refusal: 'contact-unavailable' });
    expect(write).not.toHaveBeenCalled();
  });
});
