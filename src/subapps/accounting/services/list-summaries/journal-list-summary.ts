/**
 * @fileoverview Σύνοψη λίστας Ημερολογίου Εσόδων-Εξόδων — οι κάρτες της οθόνης πάνω σε ΟΛΗ την εμβέλεια των φίλτρων
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-30, ADR-ACC-010 §2.1.1): οι κάρτες άθροιζαν τις ΦΟΡΤΩΜΕΝΕΣ γραμμές — και **μικτά** ποσά
 *   (`grossAmount`, με ΦΠΑ). Ο ΦΠΑ δεν είναι έσοδο: ένα «Καθαρό αποτέλεσμα» με ΦΠΑ μέσα διαφωνεί με κάθε αναφορά
 *   αποτελεσμάτων. Τώρα το άθροισμα είναι το SSoT των αναφορών (`partitionLedger` — καθαρά ποσά).
 *
 * 🔑 Οι αντιλογισμοί ΔΕΝ εξαιρούνται: είναι εγγραφές ίδιου τύπου με αρνητικά ποσά (`reversal-service`, storno), άρα το
 *    ζεύγος μηδενίζεται στο άθροισμα — όπως στις αναφορές. Εξαίρεσή τους θα μετρούσε την αρχική εγγραφή μόνη της.
 *
 * @see ADR-ACC-010 §2.1.1
 */

import type { JournalEntry } from '../../types/journal';
import { partitionLedger } from '../journal/journal-ledger';
import { roundToTwo } from '../../utils/math';

export interface JournalListSummary {
  readonly entryCount: number;
  /** Σ καθαρών εσόδων (χωρίς ΦΠΑ). */
  readonly totalIncome: number;
  /** Σ καθαρών εξόδων (χωρίς ΦΠΑ). */
  readonly totalExpenses: number;
  readonly netResult: number;
}

export function summarizeJournalList(entries: readonly JournalEntry[]): JournalListSummary {
  const { totalIncomeNet, totalExpenseNet } = partitionLedger(entries);
  return {
    entryCount: entries.length,
    totalIncome: totalIncomeNet,
    totalExpenses: totalExpenseNet,
    netResult: roundToTwo(totalIncomeNet - totalExpenseNet),
  };
}
