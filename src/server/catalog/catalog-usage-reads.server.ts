import 'server-only';

/**
 * =============================================================================
 * «ΧΡΗΣΙΜΟΠΟΙΕΙ ΚΑΠΟΙΟ ΠΡΟΪΟΝ ΑΥΤΟ;» — οι ερωτήσεις των σκληρύνσεων (ADR-923 §5.10 Θωράκιση 2–3 · Δ6 · Δ9)
 * =============================================================================
 *
 * Ναι/όχι ερωτήσεις (`limit(1)`) πάνω στα **παράγωγα** που γράφει μόνο ο γραφέας (`derived.*`), μέσα στη
 * συναλλαγή: η απόφαση «επιτρέπεται αυτή η αλλαγή σχήματος;» δεν αλλάζει ανάμεσα στον έλεγχο και στην εγγραφή.
 * Κάθε ερώτηση ρωτά **και τις δύο** συλλογές φορέων (μοντέλα + SKU): μια τιμή μπορεί να ζει σε οποιοδήποτε επίπεδο.
 *
 * ⚠️ Κάθε ερώτημα γράφεται με **ρητό** `COLLECTIONS.X` (όχι βοηθό που δέχεται τη συλλογή ως μεταβλητή): η πύλη
 * δεικτών του Admin SDK (CHECK 3.91) θεωρεί τη μεταβλητή συλλογή «μη αναλύσιμη» και την προσπερνά σιωπηλά. Οι
 * δείκτες τους είναι **ρητά** στο `firestore.indexes.json` (τα ερωτήματα σε συναλλαγή είναι τυφλό σημείο της 3.91 —
 * ADR-923 §5.9.1).
 *
 * @module server/catalog/catalog-usage-reads.server
 */

import type { Query } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { HumanLanguage } from '@/i18n/languages';
import { optionFacetKey } from '@/subapps/catalog/derived/holder-derived';
import type { CatalogTx } from './catalog-store.server';

/** Υπάρχει έστω ένα αποτέλεσμα σε κάποιο από τα δύο ερωτήματα; (`limit(1)` — η ερώτηση είναι ναι/όχι.) */
async function anyOf(scope: CatalogTx, queries: readonly [Query, Query]): Promise<boolean> {
  for (const query of queries) {
    if ((await scope.tx.get(query.limit(1))).size > 0) return true;
  }
  return false;
}

const activeModels = (scope: CatalogTx): Query =>
  scope.db
    .collection(COLLECTIONS.CATALOG_PRODUCT_MODELS)
    .where('companyId', '==', scope.ctx.companyId)
    .where('isDeleted', '==', false);

const activeProducts = (scope: CatalogTx): Query =>
  scope.db
    .collection(COLLECTIONS.CATALOG_PRODUCTS)
    .where('companyId', '==', scope.ctx.companyId)
    .where('isDeleted', '==', false);

/** Έχει κάποιος φορέας τιμή (ή λόγο απουσίας) γι' αυτή την ιδιότητα; */
export function attributeHasValues(scope: CatalogTx, attributeId: string): Promise<boolean> {
  return anyOf(scope, [
    activeModels(scope).where('derived.valueAttributeIds', 'array-contains', attributeId),
    activeProducts(scope).where('derived.valueAttributeIds', 'array-contains', attributeId),
  ]);
}

/** Χρησιμοποιεί κάποιος φορέας αυτή την επιλογή; (πάνω στα facets — επιλογή/πολλαπλή επιλογή εκτός πίνακα) */
export function optionInUse(scope: CatalogTx, attributeId: string, optionCode: string): Promise<boolean> {
  const key = optionFacetKey(attributeId, optionCode);
  return anyOf(scope, [
    activeModels(scope).where('derived.facetKeys', 'array-contains', key),
    activeProducts(scope).where('derived.facetKeys', 'array-contains', key),
  ]);
}

/** Αναφέρει κάποιος φορέας αυτό το μέσο; — το «πού χρησιμοποιείται» είναι αντίστροφο (Δ9). */
export function assetInUse(scope: CatalogTx, assetId: string): Promise<boolean> {
  return anyOf(scope, [
    activeModels(scope).where('derived.assetIds', 'array-contains', assetId),
    activeProducts(scope).where('derived.assetIds', 'array-contains', assetId),
  ]);
}

/** Έχει κάποιος φορέας τιμή σε αυτή τη γλώσσα; (αφαίρεση γλώσσας από τις ρυθμίσεις, Δ6) */
export function localeInUse(scope: CatalogTx, locale: HumanLanguage): Promise<boolean> {
  return anyOf(scope, [
    activeModels(scope).where('derived.valueLocales', 'array-contains', locale),
    activeProducts(scope).where('derived.valueLocales', 'array-contains', locale),
  ]);
}

/** Έχει η οικογένεια μοντέλα ή προϊόντα; (διαγραφή οικογένειας — το TODO του 1β) */
export function familyHasHolders(scope: CatalogTx, familyId: string): Promise<boolean> {
  return anyOf(scope, [
    activeModels(scope).where('familyId', '==', familyId),
    activeProducts(scope).where('familyId', '==', familyId),
  ]);
}

/** Έχει κάποιος φορέας **αυτής της οικογένειας** τιμή γι' αυτή την ιδιότητα; (αφαίρεση/μετακίνηση επιπέδου) */
export function familyAttributeHasValues(scope: CatalogTx, familyId: string, attributeId: string): Promise<boolean> {
  return anyOf(scope, [
    activeModels(scope).where('familyId', '==', familyId).where('derived.valueAttributeIds', 'array-contains', attributeId),
    activeProducts(scope).where('familyId', '==', familyId).where('derived.valueAttributeIds', 'array-contains', attributeId),
  ]);
}

/** Χρησιμοποιεί κάποιο μοντέλο αυτό το σχήμα παραλλαγών; (κλείδωμα αξόνων/επιπέδων, Θωράκιση 2) */
export async function variantSchemeInUse(scope: CatalogTx, familyId: string, schemeCode: string): Promise<boolean> {
  const snap = await scope.tx.get(
    activeModels(scope).where('familyId', '==', familyId).where('variantSchemeCode', '==', schemeCode).limit(1),
  );
  return snap.size > 0;
}
