/**
 * @fileoverview Accounting Repository — Bank Ledger Scan
 * @description Ανάγνωση των τραπεζικών κινήσεων για ΥΠΟΛΟΓΙΣΜΟ (τραπεζική συμφωνία, αποσύνδεση ομάδας N:M):
 *   ΟΛΗ η εμβέλεια ή σφάλμα.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-14, «σελίδα ≠ καθολικό» Φάση 2): η Κατάσταση Τραπεζικής Συμφωνίας ζητούσε
 *   `listBankTransactions({ dateRange }, 10000)` — το `dateRange` ΔΕΝ εφαρμοζόταν ποτέ (άρα «τρέχουσα / προηγούμενη /
 *   πέρσι» ήταν οι ΙΔΙΕΣ 10.000 νεότερες κινήσεις), η 10.001η κόβονταν σιωπηλά, και ένα αποτυχημένο ερώτημα
 *   γινόταν «καμία κίνηση» μέσω του fallback. Το ίδιο και η αποσύνδεση ομάδας N:M (όριο 100, σφάλμα = «τίποτα»).
 *
 * Ο μηχανισμός (cursor, χωρίς fallback, όριο που πετά) ζει στο SSoT `accounting-repo-scan.ts`.
 *
 * @see ADR-ACC-010 §2.1.1 · ADR-ACC-008 Bank Reconciliation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { Query } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';

import type { BankLedgerQuery, BankTransaction } from '../../types/bank';
import type { TenantContext } from '../../types/common';

import { assertLedgerPeriod, scanLedger } from './accounting-repo-scan';

const LEDGER = 'Bank ledger';

/**
 * Χτίζει το ερώτημα της εμβέλειας. Κάθε κλάδος αντιστοιχεί σε δείκτη του `firestore.indexes.json`.
 *
 * Το `transactionDate` είναι `YYYY-MM-DD` (το γράφει έτσι ο εισαγωγέας CSV), άρα το κλειστό διάστημα
 * συμβολοσειρών είναι ακριβώς το κλειστό διάστημα ημερών. Τους δείκτες φυλά η άγκυρα
 * `__tests__/bank-ledger-index.test.ts` (το CHECK 3.91 δεν βλέπει σάρωση μέσω `processAdminBatch`).
 */
export function buildBankLedgerQuery(base: Query, companyId: string, query: BankLedgerQuery): Query {
  const q = base.where('companyId', '==', companyId);
  const { scope } = query;
  if (scope.kind === 'period') {
    assertLedgerPeriod(LEDGER, scope.period);
    return q
      .where('transactionDate', '>=', scope.period.from)
      .where('transactionDate', '<=', scope.period.to)
      .orderBy('transactionDate', 'desc');
  }
  return q.where('matchGroupId', '==', scope.matchGroupId).orderBy('transactionDate', 'desc');
}

/** Όλες οι κινήσεις της εμβέλειας, νεότερη πρώτη. Πετά σε σφάλμα ή σε υπέρβαση ορίου — ποτέ μερικό. */
export async function collectBankTransactions(
  tenant: TenantContext,
  query: BankLedgerQuery,
  ceiling?: number
): Promise<BankTransaction[]> {
  return scanLedger({
    ledger: LEDGER,
    scope: query.scope,
    ceiling,
    build: (db) => buildBankLedgerQuery(db.collection(COLLECTIONS.ACCOUNTING_BANK_TRANSACTIONS), tenant.companyId, query),
    map: (data) => data as BankTransaction,
  });
}
