/**
 * @fileoverview Accounting Repository — Journal Ledger Scan
 * @description Ανάγνωση του καθολικού για ΥΠΟΛΟΓΙΣΜΟ (ΦΠΑ, φόροι, αναφορές): ΟΛΗ η εμβέλεια ή σφάλμα.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (περιστατικό 2026-10-14): οι υπολογισμοί διάβαζαν τη ΣΕΛΙΔΑ της οθόνης
 *   (`listJournalEntries`, όριο 50) → ο ΦΠΑ τριμήνου αθροιζόταν από ό,τι χωρούσε· το `period` των
 *   αναφορών αγνοούνταν σιωπηλά· και ένα αποτυχημένο ερώτημα γινόταν κενή λίστα → «ΦΠΑ 0 €».
 *
 * Ο μηχανισμός της σάρωσης (cursor, χωρίς fallback, όριο που πετά) ζει στο SSoT `accounting-repo-scan.ts`.
 *
 * @see ADR-ACC-010 Portability & Abstraction Layers (§2.1.1)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { Query } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';

import type { JournalEntry, JournalLedgerQuery, JournalScope } from '../../types/journal';
import type { TenantContext } from '../../types/common';

import { applyJournalDefaults } from './accounting-repo-financial';
import { LEDGER_SCAN_CEILING, LedgerScanLimitError, assertLedgerPeriod, scanLedger } from './accounting-repo-scan';

const LEDGER = 'Journal ledger';

/** Ανώτατο όριο της σάρωσης καθολικού (το κοινό όριο σάρωσης). */
export const JOURNAL_LEDGER_SCAN_CEILING = LEDGER_SCAN_CEILING;

/** Η εμβέλεια ξεπέρασε το ανώτατο όριο — ο υπολογισμός ΔΕΝ θα έβγαινε πλήρης, άρα δεν βγαίνει καθόλου. */
export class JournalLedgerScanLimitError extends LedgerScanLimitError {
  constructor(readonly journalScope: JournalScope, ceiling: number) {
    super(LEDGER, journalScope, ceiling);
    this.name = 'JournalLedgerScanLimitError';
  }
}

/**
 * Χτίζει το ερώτημα της εμβέλειας. Κάθε κλάδος αντιστοιχεί σε δείκτη του `firestore.indexes.json`.
 *
 * ⚠️ Το CHECK 3.91 ΔΕΝ βλέπει αυτό το ερώτημα (το τερματικό `.get()` ζει μέσα στο `processAdminBatch`)·
 * τους δείκτες του τους φυλά η άγκυρα ισοτιμίας `__tests__/journal-ledger-index.test.ts`, που εκτελεί
 * ΑΥΤΗ τη συνάρτηση για κάθε σχήμα — γι' αυτό εξάγεται.
 */
export function buildLedgerQuery(base: Query, companyId: string, query: JournalLedgerQuery): Query {
  let q = base.where('companyId', '==', companyId);
  if (query.type) q = q.where(FIELDS.TYPE, '==', query.type);

  const { scope } = query;
  if (scope.kind === 'period') {
    assertLedgerPeriod(LEDGER, scope.period);
    q = q.where('date', '>=', scope.period.from).where('date', '<=', scope.period.to);
  } else {
    q = q.where('fiscalYear', '==', scope.fiscalYear);
    if (scope.quarter) q = q.where('quarter', '==', scope.quarter);
  }
  return q.orderBy('date', 'desc');
}

/**
 * Όλες οι εγγραφές της εμβέλειας, νεότερη πρώτη. Πετά σε σφάλμα Firestore ή σε υπέρβαση του
 * `JOURNAL_LEDGER_SCAN_CEILING` — ποτέ μερικό αποτέλεσμα.
 */
export async function collectJournalEntries(
  tenant: TenantContext,
  query: JournalLedgerQuery,
  ceiling: number = JOURNAL_LEDGER_SCAN_CEILING
): Promise<JournalEntry[]> {
  return scanLedger({
    ledger: LEDGER,
    scope: query.scope,
    ceiling,
    limitError: (limit) => new JournalLedgerScanLimitError(query.scope, limit),
    build: (db) => buildLedgerQuery(db.collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES), tenant.companyId, query),
    map: (data) => applyJournalDefaults(data as JournalEntry),
  });
}
