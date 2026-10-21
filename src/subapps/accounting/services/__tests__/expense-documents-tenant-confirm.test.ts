/**
 * @jest-environment node
 *
 * ADR-917 Φ4.0 — expense documents: tenant fence on EVERY by-id access + a confirmation that cannot post twice.
 * Real repository + confirm writer on the verified fake Firestore. Each group locks one defect that was found:
 *
 *   Φ1  `getExpenseDocument` / `updateExpenseDocument` read and wrote by bare id — the `tenant` was never read
 *       ⇒ one id was enough to read AND confirm another company's invoice. Foreign ≡ absent, nothing written.
 *   Φ2  the same in the same file for APY certificates and custom categories (Boy Scout).
 *   Φ3  a missing figure became 0 € / «today» — now the confirmation is refused, naming what is missing.
 *   Φ4  confirm posted the journal entry THEN updated the document, with no state check ⇒ a double click posted
 *       two entries. Now ONE transaction, deterministic entry id, `already_confirmed` on a replay.
 *   Φ5  only `review` is confirmable; an allocation above the confirmed net amount is refused.
 *
 * All data is synthetic.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

import type { ReceivedExpenseDocument } from '../../types/documents';
import { getExpenseDocument, updateExpenseDocument, getAPYCertificate, deleteCustomCategory } from '../repository/accounting-repo-documents';
import { OwnedDocumentNotFoundError } from '../repository/tenant-owned-doc';
import { buildExpenseJournalInput, resolveExpenseConfirmation } from '../expense-confirmation-input';
import { confirmExpenseDocument, expenseJournalEntryIdOf } from '../expense-confirmation.server';

let fake = new FakeFirestore();

jest.mock('@/lib/firebaseAdmin', () => ({
  safeFirestoreOperation: async <T,>(op: (db: AdminFirestore) => Promise<T>, fallback?: T): Promise<T> => {
    try {
      return await op(fake as unknown as AdminFirestore);
    } catch (error) {
      if (fallback !== undefined) return fallback;
      throw error;
    }
  },
}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const A = { companyId: 'comp_a', userId: 'user_a' } as const;
const B = { companyId: 'comp_b', userId: 'user_b' } as const;
const DOCS = COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS;
const JOURNAL = COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES;
const db = (): AdminFirestore => fake as unknown as AdminFirestore;

const extractedData = {
  issuerName: 'ΤΣΙΜΕΝΤΑ ΑΕ', issuerVatNumber: null, issuerAddress: null, documentNumber: 'ΤΠ-17', issueDate: '2026-10-01',
  netAmount: 1000, vatAmount: 240, grossAmount: 1240, vatRate: 24, lineItems: [], paymentMethod: null, overallConfidence: 90,
};

function seedDocument(id: string, over: Partial<ReceivedExpenseDocument> = {}): void {
  fake.seed(DOCS, id, {
    documentId: id, companyId: A.companyId, createdBy: A.userId, status: 'review', type: 'purchase_invoice',
    fileName: 'inv.pdf', mimeType: 'application/pdf', fileSize: 1, fileUrl: 'x', extractedData,
    confirmedCategory: null, confirmedNetAmount: null, confirmedVatAmount: null, confirmedDate: null,
    confirmedIssuerName: null, journalEntryId: null, suggestedPOId: null, poMatchConfidence: null,
    notes: null, fiscalYear: 2026, createdAt: 'x', updatedAt: 'x', ...over,
  });
}

const confirmation = (over: Partial<Parameters<typeof buildExpenseJournalInput>[1]> = {}) => ({
  category: 'other_expense' as const, netAmount: 1000, vatAmount: 240, date: '2026-10-01', issuerName: 'ΤΣΙΜΕΝΤΑ ΑΕ', notes: null,
  ...over,
});

const journalIds = () => Object.keys(fake.getAllDocs(JOURNAL));

beforeEach(() => {
  fake = new FakeFirestore();
});

describe('Φ1 — expense document by id: foreign ≡ absent', () => {
  it('🔴 another company reads nothing', async () => {
    seedDocument('e1');
    expect(await getExpenseDocument(B, 'e1')).toBeNull();
    expect(await getExpenseDocument(A, 'e1')).toEqual(expect.objectContaining({ documentId: 'e1' }));
  });

  it('🔴 another company writes nothing — and gets the SAME answer as for a missing id', async () => {
    seedDocument('e1');
    await expect(updateExpenseDocument(B, 'e1', { status: 'rejected' })).rejects.toBeInstanceOf(OwnedDocumentNotFoundError);
    await expect(updateExpenseDocument(A, 'nope', { status: 'rejected' })).rejects.toBeInstanceOf(OwnedDocumentNotFoundError);
    expect(fake.getAllDocs(DOCS).e1.status).toBe('review');
  });

  it('🔴 a document with no companyId belongs to nobody (the empty tenant trap)', async () => {
    seedDocument('e1', { companyId: undefined });
    expect(await getExpenseDocument(A, 'e1')).toBeNull();
  });
});

describe('Φ2 — the same fence on APY certificates and custom categories', () => {
  it('🔴 foreign certificate unreadable; foreign category not deleted', async () => {
    fake.seed(COLLECTIONS.ACCOUNTING_APY_CERTIFICATES, 'c1', { companyId: A.companyId });
    fake.seed(COLLECTIONS.ACCOUNTING_CUSTOM_CATEGORIES, 'k1', { companyId: A.companyId });
    expect(await getAPYCertificate(B, 'c1')).toBeNull();
    await expect(deleteCustomCategory(B, 'k1')).rejects.toBeInstanceOf(OwnedDocumentNotFoundError);
    expect(fake.getAllDocs(COLLECTIONS.ACCOUNTING_CUSTOM_CATEGORIES).k1).toBeDefined();
  });
});

describe('Φ3 — a missing figure is not 0 €', () => {
  const doc = (over: Partial<ReceivedExpenseDocument['extractedData']> = {}) => ({
    extractedData: { ...extractedData, ...over }, confirmedCategory: null, confirmedIssuerName: null, notes: null,
  });

  it('🔴 no net / VAT / date anywhere ⇒ refused, naming every missing field', () => {
    expect(resolveExpenseConfirmation(doc({ netAmount: null, vatAmount: null, issueDate: null }), {}))
      .toEqual({ ok: false, missing: ['netAmount', 'vatAmount', 'date'] });
  });

  it('the human figure wins over the AI; the AI fills what the human left', () => {
    const resolved = resolveExpenseConfirmation(doc(), { confirmedNetAmount: 900 });
    expect(resolved).toEqual({ ok: true, confirmation: expect.objectContaining({ netAmount: 900, vatAmount: 240, date: '2026-10-01' }) });
  });

  it('a typed 0 is a figure, not a missing one', () => {
    const resolved = resolveExpenseConfirmation(doc({ vatAmount: null }), { confirmedVatAmount: 0 });
    expect(resolved.ok && resolved.confirmation.vatAmount).toBe(0);
  });

  it('zero net amount posts a 0 % VAT rate — never a division by zero', () => {
    const entry = buildExpenseJournalInput(
      { documentId: 'e1', fileName: 'f', fiscalYear: 2026, extractedData },
      confirmation({ netAmount: 0, vatAmount: 0 }),
    );
    expect(entry.vatRate).toBe(0);
    expect(entry.quarter).toBe(4);
  });
});

describe('Φ4 — ONE journal entry per document', () => {
  it('confirms in one transaction: entry at the deterministic id + the document confirmed', async () => {
    seedDocument('e1');
    const outcome = await confirmExpenseDocument(db(), A, 'e1', confirmation());
    const entryId = expenseJournalEntryIdOf(A.companyId, 'e1');
    expect(outcome).toEqual({ kind: 'confirmed', journalEntryId: entryId, previousStatus: 'review' });
    expect(journalIds()).toEqual([entryId]);
    expect(fake.getAllDocs(JOURNAL)[entryId]).toEqual(expect.objectContaining({ companyId: A.companyId, netAmount: 1000, type: 'expense' }));
    expect(fake.getAllDocs(DOCS).e1).toEqual(expect.objectContaining({ status: 'confirmed', journalEntryId: entryId, confirmedNetAmount: 1000 }));
  });

  it('🔴 a second confirm (double click / retry) posts NOTHING and answers with the same entry', async () => {
    seedDocument('e1');
    await confirmExpenseDocument(db(), A, 'e1', confirmation());
    const replay = await confirmExpenseDocument(db(), A, 'e1', confirmation({ netAmount: 5 }));
    expect(replay).toEqual({ kind: 'already_confirmed', journalEntryId: expenseJournalEntryIdOf(A.companyId, 'e1') });
    expect(journalIds()).toHaveLength(1);
    expect(fake.getAllDocs(DOCS).e1.confirmedNetAmount).toBe(1000);
  });

  it('🔴 another company cannot confirm (not_found), and nothing is posted', async () => {
    seedDocument('e1');
    expect(await confirmExpenseDocument(db(), B, 'e1', confirmation())).toEqual({ kind: 'not_found' });
    expect(journalIds()).toEqual([]);
  });
});

describe('Φ5 — what may be confirmed', () => {
  it('🔴 rejected / processing ⇒ not_reviewable, nothing posted', async () => {
    seedDocument('r', { status: 'rejected' });
    seedDocument('p', { status: 'processing' });
    expect(await confirmExpenseDocument(db(), A, 'r', confirmation())).toEqual({ kind: 'not_reviewable', status: 'rejected' });
    expect(await confirmExpenseDocument(db(), A, 'p', confirmation())).toEqual({ kind: 'not_reviewable', status: 'processing' });
    expect(journalIds()).toEqual([]);
  });

  it('🔴 an allocation above the confirmed net amount is refused (the ledger would carry more than the invoice)', async () => {
    seedDocument('e1', {
      costAllocations: [{ projectId: 'p', costCode: 'OIK-3', netAmount: 1000, purchaseOrderId: null, origin: 'manual' }],
    });
    expect(await confirmExpenseDocument(db(), A, 'e1', confirmation({ netAmount: 900 })))
      .toEqual({ kind: 'allocation_exceeds_net', allocated: 1000 });
    expect(journalIds()).toEqual([]);
  });
});
