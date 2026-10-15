/**
 * @fileoverview Accounting Repository — Fixed Asset Ledger Scan (αποσβέσεις χρήσης)
 * @description Ανάγνωση των παγίων για ΥΠΟΛΟΓΙΣΜΟ αποσβέσεων: ΟΛΗ η εμβέλεια ή σφάλμα.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-15, «σελίδα ≠ καθολικό» Φάση 4): οι αποσβέσεις χρήσης διάβαζαν
 *   `listFixedAssets({ status: 'active' })` — τη ΣΕΛΙΔΑ της οθόνης (50). Με >50 πάγια αποσβένονταν μόνο τα 50
 *   νεότερα· και το φίλτρο `active` έκρυβε όσα εκποιήθηκαν μέσα στη χρήση (χάνονταν οι μήνες ως την εκποίηση).
 *
 * Η εμβέλεια είναι «σε χρήση ως το τέλος της χρήσης» (`depreciationStartDate <= 31/12`), ΑΝΕΞΑΡΤΗΤΑ κατάστασης· ποιο
 * πάγιο έχει πράγματι απόσβεση το αποφασίζει ο πίνακας αποσβέσεων, όχι το ερώτημα.
 * Ο μηχανισμός (cursor, χωρίς fallback, όριο που πετά) ζει στο SSoT `accounting-repo-scan.ts`.
 *
 * @see ADR-ACC-010 §2.1.1 (Φάση 4)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { Query } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';

import type { FixedAsset, FixedAssetLedgerQuery } from '../../types/assets';
import type { TenantContext } from '../../types/common';

import { scanLedger } from './accounting-repo-scan';

const LEDGER = 'Fixed asset ledger';

/** Το πεδίο εύρους της σάρωσης — η έναρξη χρήσης, από την οποία μετρά η απόσβεση. */
export const FIXED_ASSET_LEDGER_RANGE_FIELD = 'depreciationStartDate';

/**
 * Αποκλειστικό άνω όριο: 1/1 της ΕΠΟΜΕΝΗΣ χρήσης. Πιάνει και `YYYY-12-31` και πλήρες ISO της ίδιας ημέρας
 * (λεξικογραφικά > `YYYY-12-31`).
 */
function exclusiveUpperBound(fiscalYear: number): string {
  if (!Number.isInteger(fiscalYear) || fiscalYear < 1900 || fiscalYear > 9998) {
    throw new Error(`${LEDGER} fiscalYear must be an integer year: ${fiscalYear}`);
  }
  return `${fiscalYear + 1}-01-01`;
}

/**
 * Χτίζει το ερώτημα της εμβέλειας. Αντιστοιχεί σε δείκτη του `firestore.indexes.json` — τον φυλά η άγκυρα
 * `__tests__/fixed-asset-ledger-index.test.ts` (το CHECK 3.91 δεν βλέπει σάρωση μέσω `processAdminBatch`).
 */
export function buildFixedAssetLedgerQuery(base: Query, companyId: string, query: FixedAssetLedgerQuery): Query {
  const upper = exclusiveUpperBound(query.scope.fiscalYear);
  return base
    .where('companyId', '==', companyId)
    .where(FIXED_ASSET_LEDGER_RANGE_FIELD, '<', upper)
    .orderBy(FIXED_ASSET_LEDGER_RANGE_FIELD, 'asc');
}

/** Όλα τα πάγια της εμβέλειας, παλαιότερο πρώτο. Πετά σε σφάλμα ή σε υπέρβαση ορίου — ποτέ μερικό. */
export async function collectFixedAssets(
  tenant: TenantContext,
  query: FixedAssetLedgerQuery,
  ceiling?: number
): Promise<FixedAsset[]> {
  return scanLedger({
    ledger: LEDGER,
    scope: query.scope,
    ceiling,
    build: (db) => buildFixedAssetLedgerQuery(db.collection(COLLECTIONS.ACCOUNTING_FIXED_ASSETS), tenant.companyId, query),
    map: (data) => data as FixedAsset,
  });
}
