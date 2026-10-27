import 'server-only';

/**
 * =============================================================================
 * «ΧΡΗΣΙΜΟΠΟΙΕΙ ΚΑΤΙ ΑΥΤΗ ΤΗΝ ΟΜΑΔΑ / ΑΥΤΗ ΤΗ ΛΙΣΤΑ;» — οι ερωτήσεις της τιμολόγησης (ADR-923 §5.11 «3β»)
 * =============================================================================
 *
 * Ναι/όχι (`limit(1)`), μέσα στη συναλλαγή — όπως το `catalog-usage-reads`. 🔑 Ρωτούν **και** τις γραμμές
 * δημοσιευμένων εκδόσεων: μια ομάδα έκπτωσης που διαγράφεται ενώ μια **παλιά** έκδοση τη φέρει θα έκανε την τιμή
 * «ως προς ημερομηνία» του παρελθόντος αδύνατη να εξηγηθεί.
 *
 * ⚠️ Κάθε ερώτημα με **ρητό** `COLLECTIONS.X` (CHECK 3.91 — η μεταβλητή συλλογή είναι «μη αναλύσιμη»).
 *
 * @module server/catalog/pricing-usage-reads.server
 */

import type { Query } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { CatalogTx } from './catalog-store.server';

async function anyOf(scope: CatalogTx, queries: readonly Query[]): Promise<boolean> {
  for (const query of queries) {
    if ((await scope.tx.get(query.limit(1))).size > 0) return true;
  }
  return false;
}

const active = (scope: CatalogTx, query: Query): Query =>
  query.where('companyId', '==', scope.ctx.companyId).where('isDeleted', '==', false);

/** Η ομάδα έκπτωσης σε γραμμή (οποιασδήποτε έκδοσης) ή σε συνθήκη. */
export function discountGroupInUse(scope: CatalogTx, discountGroupId: string): Promise<boolean> {
  return anyOf(scope, [
    active(scope, scope.db.collection(COLLECTIONS.CATALOG_PRICE_LIST_LINES)).where('discountGroupId', '==', discountGroupId),
    active(scope, scope.db.collection(COLLECTIONS.CATALOG_DISCOUNT_CONDITIONS)).where('discountGroupId', '==', discountGroupId),
  ]);
}

/** Η ομάδα πελάτη σε ανάθεση, σε κοινό συνθήκης ή σε κοινό λίστας. */
export function customerGroupInUse(scope: CatalogTx, customerGroupId: string): Promise<boolean> {
  return anyOf(scope, [
    active(scope, scope.db.collection(COLLECTIONS.CATALOG_CUSTOMER_ASSIGNMENTS)).where('customerGroupId', '==', customerGroupId),
    active(scope, scope.db.collection(COLLECTIONS.CATALOG_DISCOUNT_CONDITIONS)).where('audience.customerGroupId', '==', customerGroupId),
    active(scope, scope.db.collection(COLLECTIONS.CATALOG_PRICE_LISTS)).where('audience.customerGroupId', '==', customerGroupId),
  ]);
}

/** Έχει ο τιμοκατάλογος έστω μία έκδοση; (τότε είδος και τύπος τιμής κλειδώνουν — αλλιώς αλλάζει η σημασία τους) */
export function priceListHasVersions(scope: CatalogTx, priceListId: string): Promise<boolean> {
  return anyOf(scope, [
    active(scope, scope.db.collection(COLLECTIONS.CATALOG_PRICE_LIST_VERSIONS)).where('priceListId', '==', priceListId),
  ]);
}
