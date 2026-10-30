/**
 * @fileoverview Σύνοψη λίστας τραπεζικών κινήσεων — οι κάρτες της οθόνης πάνω σε ΟΛΗ την εμβέλεια των φίλτρων
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-30, ADR-ACC-010 §2.1.1): οι κάρτες (πλήθος · πιστώσεις · χρεώσεις · «χωρίς αντιστοίχιση»)
 *   άθροιζαν τις ΦΟΡΤΩΜΕΝΕΣ γραμμές ⇒ με 2+ σελίδες το «χωρίς αντιστοίχιση» έλεγε ψέματα για τη δουλειά που απομένει.
 *
 * @see ADR-ACC-010 §2.1.1
 */

import type { BankTransaction } from '../../types/bank';
import { roundToTwo } from '../../utils/math';

export interface BankTransactionListSummary {
  readonly transactionCount: number;
  /** Σ |ποσό| των εισερχομένων. */
  readonly totalCredit: number;
  /** Σ |ποσό| των εξερχομένων. */
  readonly totalDebit: number;
  readonly unmatchedCount: number;
}

export function summarizeBankTransactionList(transactions: readonly BankTransaction[]): BankTransactionListSummary {
  let totalCredit = 0;
  let totalDebit = 0;
  let unmatchedCount = 0;
  for (const tx of transactions) {
    // |ποσό|: η φορά τη δίνει το `direction` — ορισμένες εισαγωγές αποθηκεύουν τις χρεώσεις αρνητικές, άλλες θετικές.
    if (tx.direction === 'credit') totalCredit += Math.abs(tx.amount);
    else if (tx.direction === 'debit') totalDebit += Math.abs(tx.amount);
    if (tx.matchStatus === 'unmatched') unmatchedCount += 1;
  }
  return {
    transactionCount: transactions.length,
    totalCredit: roundToTwo(totalCredit),
    totalDebit: roundToTwo(totalDebit),
    unmatchedCount,
  };
}
