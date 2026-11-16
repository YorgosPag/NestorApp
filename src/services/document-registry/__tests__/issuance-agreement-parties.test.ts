/**
 * @jest-environment node
 *
 * ADR-915 §45.15 — **ο αναγνώστης του μηχανικού** (υπεύθυνος αυτοψίας + ιδιοκτήτες με ΑΦΜ): αποτυχία ⇒ `null`, ποτέ
 * «κανείς»· (1β-γ-2) διόρθωση ιδιοκτήτη που το γραφείο δεν εφάρμοσε ⇒ «εκκρεμεί επιβεβαίωση», ποτέ σιωπηλά λάθος ΑΦΜ.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';

import { readDocumentRegistry } from '../document-registry.service';
import { readIssuanceAgreementParties } from '../issuance-agreement-parties.server';
import type { DocumentIssuanceAssignment } from '../issuance-assignment-schema';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }) }));
jest.mock('../document-registry.service', () => ({ readDocumentRegistry: jest.fn() }));
jest.mock('@/server/lib/owned-contact-docs', () => ({ readOwnedContactDocs: jest.fn() }));
jest.mock('../issuance-assignment-schema', () => ({
  issuanceRecordOf: (assignment: { readonly record: unknown }) => assignment.record,
}));

const registry = readDocumentRegistry as jest.MockedFunction<typeof readDocumentRegistry>;
const contacts = readOwnedContactDocs as jest.MockedFunction<typeof readOwnedContactDocs>;

const DB = {} as Firestore;
const NOW = new Date('2026-11-16T09:00:00.000Z');

function assignmentWith(ownerAttestation: unknown): DocumentIssuanceAssignment {
  return {
    id: 'diss_1', companyId: 'comp_1', propertyId: 'prop_1',
    record: { inspectionContacts: [], decision: { ownerAttestation } },
  } as unknown as DocumentIssuanceAssignment;
}

beforeEach(() => {
  jest.clearAllMocks();
  registry.mockResolvedValue({ properties: { prop_1: { ownerContactIds: ['cont_a', 'cont_b'] } } } as unknown as Awaited<ReturnType<typeof readDocumentRegistry>>);
  contacts.mockResolvedValue(new Map([
    ['cont_a', { firstName: 'Άλφα', vatNumber: '090000045' }],
    ['cont_b', { firstName: 'Βήτα', vatNumber: '111111111' }],
  ]));
});

describe('ADR-915 §45.15 — readIssuanceAgreementParties', () => {
  it('χωρίς τεκμήριο ⇒ οι ιδιοκτήτες με το ΑΦΜ της επαφής, καμία εκκρεμότητα', async () => {
    const parties = await readIssuanceAgreementParties(DB, assignmentWith(null), NOW);
    expect(parties.owners).toEqual([
      { name: 'Άλφα', vatNumber: '090000045', vatPendingOfficeConfirmation: false, approvedQuote: false },
      { name: 'Βήτα', vatNumber: '111111111', vatPendingOfficeConfirmation: false, approvedQuote: false },
    ]);
    expect(contacts).toHaveBeenCalledTimes(1);
  });

  it('§45.20 — ο εγκρίνων σημειώνεται κατά ΤΑΥΤΟΤΗΤΑ επαφής (ποτέ κατά όνομα) — μόνο εκείνος', async () => {
    const assignment = {
      id: 'diss_1', companyId: 'comp_1', propertyId: 'prop_1',
      record: { inspectionContacts: [], decision: { ownerAttestation: null, ownerContactId: 'cont_b' } },
    } as unknown as DocumentIssuanceAssignment;
    const parties = await readIssuanceAgreementParties(DB, assignment, NOW);
    expect(parties.owners?.map((owner) => owner.approvedQuote)).toEqual([false, true]);
  });

  it('🔴 1β-γ-2 — διόρθωση που η επαφή ΔΕΝ έχει ⇒ «εκκρεμεί»· διόρθωση ήδη εφαρμοσμένη ⇒ όχι', async () => {
    const parties = await readIssuanceAgreementParties(DB, assignmentWith({
      owners: [
        { contactId: 'cont_a', verdict: 'corrected', vatNumber: '090000045' },
        { contactId: 'cont_b', verdict: 'corrected', vatNumber: '998877666' },
      ],
      missingNote: null,
    }), NOW);
    expect(parties.owners?.map((owner) => owner.vatPendingOfficeConfirmation)).toEqual([false, true]);
  });

  it('το μητρώο δεν διαβάστηκε ⇒ `owners: null` («δεν διαβάστηκαν»), ποτέ κενή λίστα', async () => {
    registry.mockRejectedValue(new Error('down'));
    expect((await readIssuanceAgreementParties(DB, assignmentWith(null), NOW)).owners).toBeNull();
  });
});
