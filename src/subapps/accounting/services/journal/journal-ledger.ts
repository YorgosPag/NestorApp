/**
 * @fileoverview Journal Ledger — έσοδα / έξοδα μιας εμβέλειας (SSoT)
 * @description ΕΝΑ σημείο για το «φέρε τα έσοδα και τα έξοδα της χρήσης/τριμήνου και άθροισέ τα».
 *   Ήταν αντιγραμμένο σε 7 σημεία (ΦΠΑ, φόρος, accounting-service ×4, tax dashboard), το καθένα με
 *   δύο κλήσεις στη ΣΕΛΙΔΑ της οθόνης (όριο 50) — βλ. `accounting-repo-journal-ledger.ts`.
 *
 * Μία σάρωση χωρίς `type`, διαχωρισμός στη μνήμη: οι μισές αναγνώσεις και κανένας δείκτης με `type`.
 *
 * 📘 Storno: η αρχική εγγραφή (`REVERSED`) ΚΑΙ η αντιλογιστική (αρνητικά ποσά) μετρούν, η καθεμία στην
 *   περίοδό της — άρα ΔΕΝ φιλτράρουμε `status` εδώ (SAP/Xero). Βλ. ADR-ACC-010 changelog 2026-10-14.
 *
 * @see ADR-ACC-010 Portability & Abstraction Layers
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT
 */

import type { IAccountingRepository } from '../../types/interfaces';
import type { JournalEntry, JournalScope } from '../../types/journal';
import type { EntryType, PeriodRange } from '../../types/common';
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
