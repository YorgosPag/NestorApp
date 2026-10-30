/**
 * @fileoverview **ΟΙ ΑΓΚΥΡΕΣ ΤΩΝ ΣΥΝΟΨΕΩΝ Ημερολογίου · Τράπεζας · Παγίων** — ADR-ACC-010 §2.1.1 (κάρτες σύνοψης)
 * @related services/list-summaries/{journal,bank-transaction,fixed-asset}-list-summary.ts
 */

import type { BankTransaction } from '../../../types/bank';
import type { FixedAsset } from '../../../types/assets';
import type { JournalEntry } from '../../../types/journal';
import { summarizeBankTransactionList } from '../bank-transaction-list-summary';
import { isHeldAsset, summarizeFixedAssetList } from '../fixed-asset-list-summary';
import { summarizeJournalList } from '../journal-list-summary';

const entry = (o: Partial<JournalEntry>): JournalEntry =>
  ({ type: 'income', netAmount: 100, grossAmount: 124, status: 'ACTIVE', ...o }) as unknown as JournalEntry;

const tx = (o: Partial<BankTransaction>): BankTransaction =>
  ({ direction: 'credit', amount: 100, matchStatus: 'unmatched', ...o }) as unknown as BankTransaction;

const asset = (o: Partial<FixedAsset>): FixedAsset =>
  ({ status: 'active', acquisitionCost: 1000, accumulatedDepreciation: 200, netBookValue: 800, ...o }) as unknown as FixedAsset;

describe('summarizeJournalList', () => {
  /**
   * 🔴 Οι κάρτες άθροιζαν `grossAmount` ⇒ ο ΦΠΑ μετρούσε ως έσοδο/έξοδο και το «Καθαρό αποτέλεσμα» διαφωνούσε με τις
   * αναφορές. ΜΕΤΑΛΛΑΞΗ: άθροισε `grossAmount` ⇒ κόκκινο.
   */
  it('🔴 Η1 — ΚΑΘΑΡΑ ποσά (το SSoT των αναφορών), όχι μικτά', () => {
    const summary = summarizeJournalList([entry({}), entry({ type: 'expense', netAmount: 30, grossAmount: 37.2 })]);

    expect(summary).toEqual({ entryCount: 2, totalIncome: 100, totalExpenses: 30, netResult: 70 });
  });

  /** Ο αντιλογισμός είναι ίδιος τύπος με αρνητικά ποσά (storno) — το ζεύγος μηδενίζεται, όπως στις αναφορές. */
  it('🔴 Η2 — αρχική + αντιλογισμός ⇒ 0, ΟΧΙ η αρχική μόνη της', () => {
    const summary = summarizeJournalList([
      entry({ status: 'REVERSED' }),
      entry({ netAmount: -100, grossAmount: -124, isReversal: true }),
      entry({ netAmount: 50 }),
    ]);

    expect({ income: summary.totalIncome, count: summary.entryCount }).toEqual({ income: 50, count: 3 });
  });
});

describe('summarizeBankTransactionList', () => {
  it('Τ1 — |ποσό| ανά φορά, όποιο κι αν είναι το πρόσημο της εισαγωγής', () => {
    const summary = summarizeBankTransactionList([
      tx({ amount: 100 }),
      tx({ direction: 'debit', amount: -40, matchStatus: 'auto_matched' }),
      tx({ direction: 'debit', amount: 10.1, matchStatus: 'manual_matched' }),
    ]);

    expect(summary).toEqual({ transactionCount: 3, totalCredit: 100, totalDebit: 50.1, unmatchedCount: 1 });
  });

  it('Τ2 — ο παρονομαστής: καμία κίνηση ⇒ μηδενικά (όχι NaN)', () => {
    expect(summarizeBankTransactionList([])).toEqual({ transactionCount: 0, totalCredit: 0, totalDebit: 0, unmatchedCount: 0 });
  });
});

describe('summarizeFixedAssetList', () => {
  /**
   * 🔴 Το εκποιημένο (πώληση / διαγραφή / δωρεά) έμπαινε στις αξίες ⇒ μητρώο αξίας μεγαλύτερο από ό,τι κατέχει η
   * επιχείρηση. ΜΕΤΑΛΛΑΞΗ: σβήσε το `isHeldAsset` ⇒ κόκκινο.
   */
  it('🔴 Π1 — αξίες μόνο των παγίων στην ΚΑΤΟΧΗ· το εκποιημένο μετρά μόνο στο πλήθος γραμμών', () => {
    const summary = summarizeFixedAssetList([asset({}), asset({ status: 'disposed' }), asset({ status: 'fully_depreciated', netBookValue: 0, accumulatedDepreciation: 1000 })]);

    expect(summary).toEqual({ assetCount: 3, totalCost: 2000, totalAccumulatedDepreciation: 1200, netBookValue: 800 });
  });

  /** Η αναπόσβεστη είναι η ΑΠΟΘΗΚΕΥΜΕΝΗ (την γράφει η καταχώριση αποσβέσεων), όχι «κόστος − αποσβέσεις» της οθόνης. */
  it('🔴 Π2 — αναπόσβεστη = το αποθηκευμένο `netBookValue` (π.χ. με υπολειμματική αξία)', () => {
    expect(summarizeFixedAssetList([asset({ netBookValue: 850 })]).netBookValue).toBe(850);
  });

  it('Π3 — πλήρως αποσβεσμένο / ανενεργό ΜΕΝΟΥΝ στο μητρώο', () => {
    expect(['active', 'fully_depreciated', 'inactive', 'disposed'].map((status) => isHeldAsset({ status } as FixedAsset)))
      .toEqual([true, true, true, false]);
  });
});
