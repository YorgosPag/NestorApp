/**
 * @fileoverview Journal Ledger — έσοδα / έξοδα μιας εμβέλειας (SSoT)
 * @description ΕΝΑ σημείο για το «φέρε τα έσοδα και τα έξοδα της χρήσης/τριμήνου και άθροισέ τα».
 *   Ήταν αντιγραμμένο σε 7 σημεία (ΦΠΑ, φόρος, accounting-service ×4, tax dashboard), το καθένα με
 *   δύο κλήσεις στη ΣΕΛΙΔΑ της οθόνης (όριο 50) — βλ. `accounting-repo-journal-ledger.ts`.
 *
 * Μία σάρωση χωρίς `type`, διαχωρισμός στη μνήμη: οι μισές αναγνώσεις και κανένας δείκτης με `type`.
 *
 * 📘 Φόρος εισοδήματος: `ledgerTaxTotals` — το βιβλίο είναι η ΜΙΑ πηγή και των εισφορών ΕΦΚΑ (2026-11-07).
 *   Πριν: αφαιρούνταν ΚΑΙ από τις εγγραφές πληρωμών ΕΦΚΑ ⇒ κρυφή διπλομέτρηση (ADR-ACC-006 §7.1).
 *
 * 📘 Storno: η αρχική εγγραφή (`REVERSED`) ΚΑΙ η αντιλογιστική (αρνητικά ποσά) μετρούν, η καθεμία στην
 *   περίοδό της — άρα ΔΕΝ φιλτράρουμε `status` εδώ (SAP/Xero). Βλ. ADR-ACC-010 changelog 2026-10-14.
 *
 * @see ADR-ACC-010 Portability & Abstraction Layers
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT
 */

import type { IAccountingRepository } from '../../types/interfaces';
import type { JournalEntry, JournalScope } from '../../types/journal';
import type { EntryType, ExpenseCategory, PeriodRange } from '../../types/common';
import { roundToTwo } from '../../utils/math';

/** Τα έσοδα και τα έξοδα μιας εμβέλειας, με τα καθαρά τους σύνολα. */
export interface JournalLedger {
  readonly income: readonly JournalEntry[];
  readonly expense: readonly JournalEntry[];
  /** Σ `netAmount` εσόδων, στρογγυλεμένο σε λεπτά */
  readonly totalIncomeNet: number;
  /** Σ `netAmount` εξόδων, στρογγυλεμένο σε λεπτά */
  readonly totalExpenseNet: number;
}

/** Καθαρό σύνολο εγγραφών, στρογγυλεμένο σε λεπτά. */
export function sumNetAmount(entries: readonly JournalEntry[]): number {
  return roundToTwo(entries.reduce((sum, e) => sum + e.netAmount, 0));
}

/** Ομάδα εγγραφών με κοινό κλειδί: καθαρό σύνολο, πλήθος, και η πρώτη εγγραφή (για ετικέτες). */
export interface NetGroup {
  readonly total: number;
  readonly count: number;
  readonly first: JournalEntry;
}

/** Ομαδοποίηση ανά κλειδί (κατηγορία, πελάτης, …) με άθροισμα `netAmount` — ΕΝΑ σημείο για τις αναφορές. */
export function groupNetAmount<K>(
  entries: readonly JournalEntry[],
  keyOf: (entry: JournalEntry) => K
): Map<K, NetGroup> {
  const groups = new Map<K, NetGroup>();
  for (const entry of entries) {
    const key = keyOf(entry);
    const existing = groups.get(key);
    groups.set(key, existing
      ? { total: existing.total + entry.netAmount, count: existing.count + 1, first: existing.first }
      : { total: entry.netAmount, count: 1, first: entry });
  }
  return groups;
}

/** Ποσοστό ομάδας στο σύνολο — 0 όταν το σύνολο δεν είναι θετικό. */
export function shareOf(total: number, grandTotal: number): number {
  return grandTotal > 0 ? (total / grandTotal) * 100 : 0;
}

/** Διαχωρίζει τις εγγραφές σε έσοδα / έξοδα και υπολογίζει τα σύνολα. Καθαρή συνάρτηση. */
export function partitionLedger(entries: readonly JournalEntry[]): JournalLedger {
  const income: JournalEntry[] = [];
  const expense: JournalEntry[] = [];
  for (const entry of entries) {
    if (entry.type === 'income') income.push(entry);
    else expense.push(entry);
  }
  return {
    income,
    expense,
    totalIncomeNet: sumNetAmount(income),
    totalExpenseNet: sumNetAmount(expense),
  };
}

// ============================================================================
// ΣΥΝΟΛΑ ΦΟΡΟΥ ΕΙΣΟΔΗΜΑΤΟΣ — το Βιβλίο Ε-Ε ως ΜΙΑ πηγή των εκπιπτόμενων εισφορών ΕΦΚΑ
// ============================================================================

/**
 * Η κατηγορία εξόδου των εισφορών ΕΦΚΑ του επιτηδευματία (`config/account-categories.ts`, Ε3 `585_005`,
 * myDATA `category2_12`). Οι εγγραφές πληρωμών (`accounting_efka_payments`) είναι **βοηθητικό** βιβλίο —
 * πρόγραμμα, υπενθυμίσεις, αντιστοίχιση — και ΔΕΝ δίνουν ποτέ ποσό φόρου (ADR-ACC-006 §7.1).
 */
const EFKA_CONTRIBUTION_CATEGORY: ExpenseCategory = 'efka';

/** Είναι η εγγραφή εισφορά ΕΦΚΑ; — το ΕΝΑ κριτήριο για φόρο και αναφορές. */
export function isEfkaContribution(entry: JournalEntry): boolean {
  return entry.type === 'expense' && entry.category === EFKA_CONTRIBUTION_CATEGORY;
}

/**
 * Τα σύνολα του φόρου εισοδήματος. Ισχύει πάντα `totalExpenses + efkaContributions = Σ εξόδων του βιβλίου`:
 * η ΕΦΚΑ αφαιρείται ΜΙΑ φορά, απλώς **φαίνεται χωριστά** (Ε3 / E1, ανάλυση φόρου).
 */
export interface LedgerTaxTotals {
  /** Σ καθαρών εσόδων */
  readonly totalIncome: number;
  /** Σ καθαρών εξόδων ΧΩΡΙΣ τις εισφορές ΕΦΚΑ */
  readonly totalExpenses: number;
  /** Εισφορές ΕΦΚΑ καταχωρημένες στο βιβλίο (κατηγορία `efka`) */
  readonly efkaContributions: number;
}

/** Οι εγγραφές του βιβλίου που χρειάζεται ο υπολογισμός — ολόκληρο το `JournalLedger` ή ένα φιλτραρισμένο κομμάτι του. */
type LedgerEntries =Pick<JournalLedger, 'income' | 'expense'>;

/** Τα σύνολα φόρου εισοδήματος από το Βιβλίο Ε-Ε (SSoT). Καθαρή συνάρτηση. */
export function ledgerTaxTotals(ledger: LedgerEntries): LedgerTaxTotals {
  const allExpenses = sumNetAmount(ledger.expense);
  const efkaContributions = sumNetAmount(ledger.expense.filter(isEfkaContribution));
  return {
    totalIncome: sumNetAmount(ledger.income),
    totalExpenses: roundToTwo(allExpenses - efkaContributions),
    efkaContributions,
  };
}

/** Το κομμάτι του βιβλίου που περνά το φίλτρο (περίοδος, «έως σήμερα», …). */
export function filterLedgerEntries(
  ledger: LedgerEntries,
  keep: (entry: JournalEntry) => boolean
): LedgerEntries {
  return { income: ledger.income.filter(keep), expense: ledger.expense.filter(keep) };
}

/** Αναγωγή σε έτος (IAS 34 / πρόβλεψη) — ΚΑΙ τα τρία σύνολα με τον ίδιο συντελεστή. */
export function scaleLedgerTaxTotals(totals: LedgerTaxTotals, factor: number): LedgerTaxTotals {
  return {
    totalIncome: roundToTwo(totals.totalIncome * factor),
    totalExpenses: roundToTwo(totals.totalExpenses * factor),
    efkaContributions: roundToTwo(totals.efkaContributions * factor),
  };
}

/** Όλες οι εγγραφές ενός κλειστού διαστήματος ημερομηνιών (προαιρετικά ενός τύπου) — για αναφορές. */
export function loadPeriodEntries(
  repository: Pick<IAccountingRepository, 'collectJournalEntries'>,
  period: PeriodRange,
  type?: EntryType
): Promise<JournalEntry[]> {
  return repository.collectJournalEntries({ scope: { kind: 'period', period }, type });
}

/** Ολόκληρο το καθολικό της εμβέλειας, χωρισμένο σε έσοδα / έξοδα. Πετά αντί να επιστρέψει μερικό. */
export async function loadLedger(
  repository: Pick<IAccountingRepository, 'collectJournalEntries'>,
  scope: JournalScope
): Promise<JournalLedger> {
  return partitionLedger(await repository.collectJournalEntries({ scope }));
}
