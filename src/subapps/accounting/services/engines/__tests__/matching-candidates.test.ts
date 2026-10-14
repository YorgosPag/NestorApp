/**
 * @fileoverview Στένεμα υποψηφίων αντιστοίχισης — ζώνη ποσού, αναφορές, συμπεριφορά του engine
 * @description ADR-ACC-010 §2.1.1 (Φάση 2). Το πρώτο μπλοκ είναι το αμετάβλητο που κάνει το στένεμα ασφαλές:
 *   «ό,τι η βαθμολόγηση θα δεχόταν κατά ποσό, η ζώνη ανάκτησης το φέρνει». Αν σπάσει, το στένεμα κρύβει τη σωστή
 *   αντιστοίχιση — ακριβώς το λάθος που διόρθωσε (όριο 100).
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { IAccountingRepository } from '../../../types/interfaces';
import type { BankTransaction } from '../../../types/bank';
import type { Invoice, InvoiceSeries } from '../../../types/invoice';
import type { JournalEntry } from '../../../types/journal';
import { DEFAULT_MATCHING_CONFIG } from '../../../types/matching-config';
import { amountBandFor, combinationBandFor, scoreAmount } from '../matching-scoring';
import { extractInvoiceReferences, foldReferenceText } from '../matching-reference';
import { MatchingEngine } from '../matching-engine';
import type { RuleLearningEngine } from '../rule-learning-engine';

jest.mock('@/services/enterprise-id.service', () => ({ generateMatchGroupId: () => 'mgrp_test' }));

// ============================================================================
// Α. Ζώνη ποσού = ακριβές αντίστροφο του scoreAmount
// ============================================================================

describe('Α — η ζώνη ανάκτησης δεν κρύβει ποτέ υποψήφιο που η βαθμολόγηση δέχεται', () => {
  const AMOUNTS = [0.01, 0.99, 1, 7.5, 99.99, 100, 123.45, 1000, 9_999.99, 250_000];
  const TOLERANCES = [0, 1, 2.5, 5, 10, 50];

  /** Κάθε λεπτό σε ±2 € γύρω από ένα όριο — εκεί μόνο μπορεί να σπάσει η ισότητα (στρογγύλευση). */
  const around = (edge: number) =>
    Array.from({ length: 401 }, (_, i) => Math.round(edge * 100 + i - 200) / 100).filter((c) => c > 0);

  it.each(TOLERANCES)('Α-1 ανοχή %s%%: κάθε c με scoreAmount > 0 είναι μέσα στη ζώνη', (tol) => {
    for (const t of AMOUNTS) {
      const band = amountBandFor(t, tol);
      const p = tol / 100;
      const edges = [t / (1 + p), t, ...(p < 1 ? [t / (1 - p)] : [])];
      for (const c of edges.flatMap(around)) {
        if (scoreAmount(t, c, tol).score > 0) {
          expect(c).toBeGreaterThanOrEqual(band.min);
          expect(c).toBeLessThanOrEqual(band.max);
        }
      }
    }
  });

  it('Α-2 η ζώνη ΕΙΝΑΙ στενή: λίγο έξω από την ανοχή ⇒ έξω από τη ζώνη (αλλιώς δεν στενεύει τίποτα)', () => {
    const band = amountBandFor(100, 5);
    expect(band.min).toBeGreaterThan(94);
    expect(band.max).toBeLessThan(106);
  });

  it('Α-3 ζώνη συνδυασμού: κάθε μέλος έγκυρου συνδυασμού (≤ άνω όριο συνόλου) χωρά', () => {
    const band = combinationBandFor(300, 5);
    expect(band.min).toBe(0);
    expect(band.max).toBeGreaterThanOrEqual(315);
  });
});

// ============================================================================
// Β. Αναφορές παραστατικών στο κείμενο της τράπεζας
// ============================================================================

const SERIES: InvoiceSeries[] = [
  { code: 'A', prefix: 'ΤΠΥ-Α', nextNumber: 200, documentTypes: [], isActive: true, description: '' },
  { code: 'CREDIT', prefix: 'ΠΙΣ', nextNumber: 5, documentTypes: [], isActive: true, description: '' },
];

describe('Β — extractInvoiceReferences', () => {
  it.each([
    ['A-123', 123],
    ['Εξόφληση τιμ. Α 123', 123], // ελληνικό «Α»
    ['ΤΠΥ-Α/0123', 123],
    ['πληρωμη a#123 υπολοιπο', 123],
    ['ΤΠΥ-Α 123', 123],
  ])('Β-1 «%s» ⇒ A-%i', (text, number) => {
    expect(extractInvoiceReferences([text], SERIES)).toEqual([{ series: 'A', number }]);
  });

  it('Β-2 ψευδώνυμο μέσα σε λέξη ή αριθμός μέσα σε μεγαλύτερο ⇒ τίποτα', () => {
    expect(extractInvoiceReferences(['DATA 123'], SERIES)).toEqual([]); // «A» μέσα στο DATA
    expect(extractInvoiceReferences(['IBAN GR12A1234567'], SERIES)).toEqual([]);
  });

  it('Β-3 πολλές αναφορές, πολλές σειρές, διπλότυπα ⇒ μοναδικά', () => {
    const refs = extractInvoiceReferences(['A-1 και A-2', 'ΠΙΣ 7 / A-1', null], SERIES);
    expect(refs).toEqual(expect.arrayContaining([
      { series: 'A', number: 1 }, { series: 'A', number: 2 }, { series: 'CREDIT', number: 7 },
    ]));
    expect(refs).toHaveLength(3);
  });

  it('Β-4 ομόγλυφα: ελληνικό και λατινικό «A» αναδιπλώνονται στο ίδιο', () => {
    expect(foldReferenceText('Α')).toBe(foldReferenceText('A'));
  });
});

// ============================================================================
// Γ. Engine — δύο κανάλια, κανόνας εισόδου, σφάλμα ≠ κενό
// ============================================================================

const TXN: BankTransaction = {
  transactionId: 'btx_1', accountId: 'acc', valueDate: '2026-05-10', transactionDate: '2026-05-10',
  direction: 'credit', amount: 100, currency: 'EUR', balanceAfter: null,
  bankDescription: 'ΕΞΟΦΛΗΣΗ ΠΑΠΑΔΟΠΟΥΛΟΣ', counterparty: 'ΠΑΠΑΔΟΠΟΥΛΟΣ', paymentReference: 'ΤΠΥ-Α 42',
  matchStatus: 'unmatched', matchedEntityId: null, matchedEntityType: null, matchConfidence: null,
} as BankTransaction;

function invoice(id: string, number: number, balanceDue: number): Invoice {
  return {
    invoiceId: id, series: 'A', number, issueDate: '2026-05-01', currency: 'EUR', paymentStatus: 'unpaid',
    balanceDue, totalGrossAmount: balanceDue, customer: { name: 'ΠΑΠΑΔΟΠΟΥΛΟΣ' },
  } as unknown as Invoice;
}

function journal(id: string, grossAmount: number): JournalEntry {
  return {
    entryId: id, date: '2026-05-09', description: 'Είσπραξη', grossAmount, contactName: null,
    invoiceId: null, status: 'ACTIVE', fiscalYear: 2026,
  } as unknown as JournalEntry;
}

function mockRepository(overrides: Partial<Record<keyof IAccountingRepository, jest.Mock>> = {}) {
  const repo = {
    getMatchingConfig: jest.fn(async () => null),
    collectOpenInvoicesByAmount: jest.fn(async () => [invoice('inv_band', 41, 100)]),
    findOpenInvoicesByReference: jest.fn(async () => [invoice('inv_ref', 42, 250)]),
    collectActiveJournalEntriesByAmount: jest.fn(async () => [journal('je_1', 100)]),
    getInvoiceSeries: jest.fn(async () => SERIES),
    getEFKAPayments: jest.fn(async () => []),
    getTaxInstallments: jest.fn(async () => []),
    collectBankTransactions: jest.fn(async () => []),
    updateBankTransaction: jest.fn(async () => undefined),
    listInvoices: jest.fn(),
    listJournalEntries: jest.fn(),
    listBankTransactions: jest.fn(),
    ...overrides,
  };
  return repo;
}

const asRepository = (repo: ReturnType<typeof mockRepository>) => repo as unknown as IAccountingRepository;

describe('Γ — MatchingEngine: στένεμα αντί για σελίδα', () => {
  it('Γ-1 ζητά τη ζώνη ανοχής της κίνησης και τη χρήση της — ΠΟΤΕ σελίδα', async () => {
    const repo = mockRepository();
    await new MatchingEngine(asRepository(repo)).findCandidates(TXN);

    const band = amountBandFor(100, DEFAULT_MATCHING_CONFIG.amountTolerancePercent);
    expect(repo.collectOpenInvoicesByAmount).toHaveBeenCalledWith(band);
    expect(repo.collectActiveJournalEntriesByAmount).toHaveBeenCalledWith(2026, band);
    expect(repo.listInvoices).not.toHaveBeenCalled();
    expect(repo.listJournalEntries).not.toHaveBeenCalled();
  });

  it('Γ-2 η αναφορά στο κείμενο φέρνει τιμολόγιο ΕΚΤΟΣ ζώνης (μερική πληρωμή) — και περνά τον κανόνα εισόδου', async () => {
    const repo = mockRepository();
    await new MatchingEngine(asRepository(repo)).findCandidates(TXN);
    expect(repo.findOpenInvoicesByReference).toHaveBeenCalledWith([{ series: 'A', number: 42 }]);
  });

  it('Γ-3 χρεωστική κίνηση ⇒ κανένα ερώτημα τιμολογίων (ίδια σημασιολογία με πριν)', async () => {
    const repo = mockRepository();
    await new MatchingEngine(asRepository(repo)).findCandidates({ ...TXN, direction: 'debit' });
    expect(repo.collectOpenInvoicesByAmount).not.toHaveBeenCalled();
    expect(repo.findOpenInvoicesByReference).not.toHaveBeenCalled();
  });

  it('Γ-4 μπόνους κανόνα ΔΕΝ κάνει υποψήφιο ένα λάθος ποσό χωρίς αναφορά (65 + 15 ≥ 70 πριν)', async () => {
    // Ίδια μέρα + ίδιο όνομα + ίδιες λέξεις: 42,5 + 10 + 5 ≈ 58, +15 μπόνους = 73 ≥ 70 χωρίς τον κανόνα εισόδου.
    const wrongAmount = { ...invoice('inv_wrong', 9, 500), issueDate: '2026-05-10' } as unknown as Invoice;
    const repo = mockRepository({
      collectOpenInvoicesByAmount: jest.fn(async () => [wrongAmount]),
      findOpenInvoicesByReference: jest.fn(async () => []),
      collectActiveJournalEntriesByAmount: jest.fn(async () => []),
    });
    const ruleLearning = { getRuleBonus: jest.fn(async () => 15) } as unknown as RuleLearningEngine;
    const candidates = await new MatchingEngine(asRepository(repo), ruleLearning).findCandidates({
      ...TXN, bankDescription: 'A-9 ΠΑΠΑΔΟΠΟΥΛΟΣ', paymentReference: null,
    });
    expect(candidates.map((c) => c.entityId)).not.toContain('inv_wrong');
  });

  it('Γ-5 σφάλμα ανάκτησης ⇒ σφάλμα, ΟΧΙ «κανένα υποψήφιο»', async () => {
    const repo = mockRepository({
      collectOpenInvoicesByAmount: jest.fn(async () => { throw new Error('FAILED_PRECONDITION'); }),
    });
    await expect(new MatchingEngine(asRepository(repo)).findCandidates(TXN)).rejects.toThrow('FAILED_PRECONDITION');
  });

  it('Γ-6 αποσύνδεση ομάδας: ΟΛΑ τα μέλη από το καθολικό τράπεζας, όχι τα 100 πρώτα', async () => {
    const members = Array.from({ length: 150 }, (_, i) => ({ ...TXN, transactionId: `btx_${i}` }));
    const repo = mockRepository({ collectBankTransactions: jest.fn(async () => members) });
    await new MatchingEngine(asRepository(repo)).unmatchGroup('mgrp_1');

    expect(repo.collectBankTransactions).toHaveBeenCalledWith({ scope: { kind: 'matchGroup', matchGroupId: 'mgrp_1' } });
    expect(repo.updateBankTransaction).toHaveBeenCalledTimes(150);
    expect(repo.listBankTransactions).not.toHaveBeenCalled();
  });

  it('Γ-7 ομάδες N:M ζητούν τη ζώνη μελών (0 … σύνολο + ανοχή)', async () => {
    const repo = mockRepository();
    await new MatchingEngine(asRepository(repo)).findCandidateGroups([TXN, { ...TXN, amount: 50 }]);
    expect(repo.collectOpenInvoicesByAmount).toHaveBeenCalledWith(
      combinationBandFor(150, DEFAULT_MATCHING_CONFIG.amountTolerancePercent)
    );
  });
});
