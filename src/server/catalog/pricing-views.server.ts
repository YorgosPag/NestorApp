import 'server-only';

/**
 * **Οι όψεις τιμών — η ΜΟΝΗ πόρτα των τιμών προς τον πελάτη** (ADR-923 §5.11 «3δ» Ζ).
 *
 * Οι συλλογές τιμολόγησης είναι `read: false` για τον πελάτη: η εξουσιοδότηση προβολής (`catalog:pricing:view`) =
 * δικαιώματα ρόλου ∪ claim, και την κρίνει **μόνο** ο κριτής του διακομιστή (ADR-801) — κανόνας Firestore δεν βλέπει τον
 * κατάλογο ρόλων. SAP (VK13) και commercetools (`view_*`) επιβάλλουν την προβολή στον διακομιστή, όχι στο UI.
 *
 * 🔑 **Μία συναλλαγή ανάγνωσης ανά όψη**: αριθμός σήματος και δεδομένα είναι το **ίδιο** στιγμιότυπο (ADR-905 §4.3) —
 *    η όψη δεν είναι ποτέ πιο παλιά από τον αριθμό της, και η δική μου πράξη δεν φέρνει δεύτερη ανάγνωση.
 * 🔑 Καμία νέα ερώτηση εκδόσεων/γραμμών: `readListVersions` · `versionLinesPage` της 3β (ίδιοι δείκτες).
 *
 * @module server/catalog/pricing-views.server
 */

import type { Query } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { pricingFreshUntil } from '@/subapps/catalog/pricing/pricing-view-freshness';
import type { DiscountsView, PriceLinesPageView, PriceListsView, PriceListWire } from '@/subapps/catalog/types/pricing-views';
import { isPublishedStatus, PRICE_LINES_PER_TRANSACTION } from '@/subapps/catalog/vocabulary/pricing';
import { readOwned, runCatalogTransaction, type CatalogTx } from './catalog-store.server';
import type { StoredPriceLine, StoredPriceVersion } from './price-version-aggregate.server';
import { readListVersions, readSkuIdentifiers, versionLinesPage } from './price-version-reads.server';
import { readPricingViewRevisionInTx } from './pricing-view-signal.server';

/** Οι ενεργές εγγραφές μιας συλλογής ρυθμίσεων του χώρου (λίγες δεκάδες — ίδια πρακτική με το σχήμα του καταλόγου). */
async function readActive<T>(scope: CatalogTx, collection: string): Promise<T[]> {
  const query: Query = scope.db.collection(collection).where('companyId', '==', scope.ctx.companyId).where('isDeleted', '==', false);
  const snap = await scope.tx.get(query);
  return snap.docs.map((doc) => doc.data() as T);
}

const asOfOf = (nowMs: number): string => new Date(nowMs).toISOString();

/** `lists` — οι τιμοκατάλογοι + όλες οι ενεργές εκδόσεις τους (η χρονογραμμή χτίζεται στον πελάτη, από τον ίδιο κώδικα). */
export function readPriceListsView(ctx: AuthContext, nowMs = Date.now()): Promise<PriceListsView> {
  return runCatalogTransaction(ctx, async (scope) => {
    const revision = await readPricingViewRevisionInTx(scope.tx, scope.db, ctx.companyId, { kind: 'lists' });
    const lists = await readActive<PriceListWire>(scope, COLLECTIONS.CATALOG_PRICE_LISTS);
    const versions = (await Promise.all(lists.map((list) => readListVersions(scope, list.id)))).flat();
    const starts = versions.filter((version) => isPublishedStatus(version.status)).map((version) => version.validFrom);
    return { freshness: { revision, freshUntil: pricingFreshUntil(nowMs, starts) }, asOf: asOfOf(nowMs), lists, versions };
  });
}

/** `list:{id}` — μία σελίδα γραμμών μιας έκδοσης, μετά τον δρομέα (id εγγράφου). */
/** Κωδικός SKU ανά `variantId` για τις ζωντανές παραλλαγές της σελίδας — **μία** `getAll` στη συναλλαγή της όψης. */
export function readPriceLinesPage(ctx: AuthContext, versionId: string, cursor: string | null, nowMs = Date.now()): Promise<PriceLinesPageView> {
  return runCatalogTransaction(ctx, async (scope) => {
    const version = await readOwned<StoredPriceVersion>(scope, 'priceListVersion', versionId);
    const view = { kind: 'list', priceListId: version.priceListId } as const;
    const revision = await readPricingViewRevisionInTx(scope.tx, scope.db, ctx.companyId, view);
    const snap = await scope.tx.get(versionLinesPage(scope.db, ctx.companyId, version.id, cursor));
    const lines = snap.docs.map((doc) => doc.data() as StoredPriceLine);
    const nextCursor = lines.length === PRICE_LINES_PER_TRANSACTION ? lines[lines.length - 1].id : null;
    const skuIdentifiers = await readSkuIdentifiers(scope, lines.map((line) => line.subject));
    return { freshness: { revision, freshUntil: pricingFreshUntil(nowMs, []) }, version, lines, skuIdentifiers, nextCursor };
  });
}

/** `discounts` — ομάδες, αναθέσεις, συνθήκες· η φρεσκάδα λήγει στο πρώτο όριο ισχύος συνθήκης που έρχεται. */
export function readDiscountsView(ctx: AuthContext, nowMs = Date.now()): Promise<DiscountsView> {
  return runCatalogTransaction(ctx, async (scope) => {
    const revision = await readPricingViewRevisionInTx(scope.tx, scope.db, ctx.companyId, { kind: 'discounts' });
    const [discountGroups, customerGroups, assignments, conditions] = await Promise.all([
      readActive<DiscountsView['discountGroups'][number]>(scope, COLLECTIONS.CATALOG_DISCOUNT_GROUPS),
      readActive<DiscountsView['customerGroups'][number]>(scope, COLLECTIONS.CATALOG_CUSTOMER_GROUPS),
      readActive<DiscountsView['assignments'][number]>(scope, COLLECTIONS.CATALOG_CUSTOMER_ASSIGNMENTS),
      readActive<DiscountsView['conditions'][number]>(scope, COLLECTIONS.CATALOG_DISCOUNT_CONDITIONS),
    ]);
    const bounds = conditions.flatMap((condition) => [condition.validFrom, condition.validUntil]);
    const freshness = { revision, freshUntil: pricingFreshUntil(nowMs, bounds) };
    return { freshness, asOf: asOfOf(nowMs), discountGroups, customerGroups, assignments, conditions };
  });
}
