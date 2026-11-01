import 'server-only';

/**
 * **Αναζήτηση SKU σε ξένο κατάλογο** (ADR-923 §5.12 τμήμα 4): ο αγοραστής βρίσκει το `variantId` που ζητά η τιμή.
 *
 * 1. **Ακριβής κωδικός πρώτα**, με το ίδιο `resolveCatalogCode` του άλματος: κανένα ερώτημα λίστας, καμία εξάρτηση από δείκτη.
 *    Κωδικός μοντέλου ⇒ τα SKU του.
 * 2. **Μετά λέξεις:** `array-contains` σε ένα πρόθεμα, κρίση ολόκληρου του όρου στη μνήμη.
 *
 * 🔑 Η ορατότητα κρίνεται **μετά** το κείμενο και μόνο για τα υποψήφια, με τους κανόνες να διαβάζονται μία φορά. Έτσι η ΜΙΑ κρίση
 *    (`judgeVisibility`) τρέχει ανά SKU χωρίς το κόστος να ακολουθεί το μέγεθος του καταλόγου.
 * ⛔ Τρέχει **μόνο** μέσα σε ξένη σκοπιά που άνοιξε ο ένας αναγνώστης (CHECK 3.106). Δέχεται `CatalogReadScope`, άρα γραφή αδύνατη.
 * @module server/supply-relationships/supply-foreign-search.server
 */

import type { DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { readActiveByIds } from '@/server/catalog/catalog-library-reads.server';
import { readOwnedOrNull, type CatalogReadScope, type StoredCatalogRecord } from '@/server/catalog/catalog-store.server';
import { ancestryOfHolder, readVisibilityRules } from '@/server/catalog/visibility-reads.server';
import { catalogSearchPlan, catalogSearchText, matchesCatalogSearch, type CatalogSearchPlan } from '@/subapps/catalog/derived/search-prefixes';
import { resolveCatalogCode, type CodeJumpReader, type CodeJumpTarget, type UniqueAttributeRef } from '@/subapps/catalog/list/catalog-code-jump';
import { FOREIGN_SKU_RESULTS, FOREIGN_SKU_WINDOW, FOREIGN_SKU_WINDOWS, foreignSkuRowOf, type ForeignSkuRow } from '@/subapps/catalog/pricing/foreign-sku-search';
import { judgeVisibility } from '@/subapps/catalog/pricing/visibility';
import type { PricingViewer } from '@/subapps/catalog/types/price-list';
import type { CatalogProductDefinition, CatalogProductModelDefinition } from '@/subapps/catalog/types/product';
import type { CatalogProductDerived, CatalogProductModelDerived } from '@/subapps/catalog/types/product-derived';

type StoredSku = StoredCatalogRecord<CatalogProductDefinition> & { readonly derived: CatalogProductDerived };
type StoredModel = StoredCatalogRecord<CatalogProductModelDefinition> & { readonly derived: CatalogProductModelDerived };
type JudgeSkus = (skus: readonly StoredSku[]) => Promise<readonly ForeignSkuRow[]>;

/** Ο αναγνώστης του άλματος μέσα στη συναλλαγή. Τα ids είναι ντετερμινιστικά, και ο χώρος ξαναρωτιέται: ξένο ≡ ανύπαρκτο. */
const codeReaderOf = (scope: CatalogReadScope): CodeJumpReader => async (collection, id) => {
  const data = (await scope.tx.get(scope.db.collection(COLLECTIONS[collection]).doc(id))).data();
  return data !== undefined && isPayloadOwnedByCompany(data, scope.ctx.companyId) ? data : null;
};

async function readUniqueAttributes(scope: CatalogReadScope): Promise<readonly UniqueAttributeRef[]> {
  const snap = await scope.tx.get(
    scope.db
      .collection(COLLECTIONS.CATALOG_ATTRIBUTES)
      .where('companyId', '==', scope.ctx.companyId)
      .where('isDeleted', '==', false)
      .where('unique', '==', true),
  );
  return snap.docs.map((doc) => ({ id: doc.id, type: doc.get('type') as UniqueAttributeRef['type'] }));
}

/** Τα SKU ενός μοντέλου, από το ευρετήριο απογόνων που κρατά η ρίζα. */
async function skuIdsOfModel(scope: CatalogReadScope, modelId: string): Promise<readonly string[]> {
  const model = await readOwnedOrNull<CatalogProductModelDefinition>(scope, 'productModel', modelId) as StoredModel | null;
  if (model === null) return [];
  const root = model.parentId === null ? model : await readOwnedOrNull<CatalogProductModelDefinition>(scope, 'productModel', model.parentId) as StoredModel | null;
  return Object.entries(root?.derived.descendants ?? {})
    .filter(([, entry]) => entry.kind === 'product' && (model.parentId === null || entry.parentId === model.id))
    .map(([id]) => id)
    .slice(0, FOREIGN_SKU_WINDOW);
}

async function skusOfTarget(scope: CatalogReadScope, target: CodeJumpTarget | null): Promise<readonly StoredSku[]> {
  if (target === null) return [];
  const ids = target.kind === 'product' ? [target.id] : await skuIdsOfModel(scope, target.id);
  return [...(await readActiveByIds<CatalogProductDefinition>(scope, 'product', ids)).values()] as StoredSku[];
}

async function exactRows(scope: CatalogReadScope, term: string, judge: JudgeSkus): Promise<readonly ForeignSkuRow[]> {
  const target = await resolveCatalogCode(scope.ctx.companyId, term, await readUniqueAttributes(scope), codeReaderOf(scope));
  return judge(await skusOfTarget(scope, target));
}

const matches = (plan: CatalogSearchPlan) => (sku: StoredSku): boolean =>
  matchesCatalogSearch(catalogSearchText(sku.derived.label, sku.derived.identifier), plan.tokens);

/** Παράθυρα κατά `sortKey`, ώσπου να γεμίσει η λίστα. Το τέλος του προϋπολογισμού ⇒ «γράψε κι άλλο», ποτέ δρομέας προς τον πελάτη. */
async function wordRows(scope: CatalogReadScope, plan: CatalogSearchPlan, judge: JudgeSkus): Promise<readonly ForeignSkuRow[]> {
  if (plan.seed === null) return [];
  const query = scope.db
    .collection(COLLECTIONS.CATALOG_PRODUCTS)
    .where('companyId', '==', scope.ctx.companyId)
    .where('isDeleted', '==', false)
    .where('derived.searchPrefixes', 'array-contains', plan.seed)
    .orderBy('derived.sortKey')
    .limit(FOREIGN_SKU_WINDOW);
  const rows: ForeignSkuRow[] = [];
  let after: QueryDocumentSnapshot<DocumentData> | null = null;
  for (let window = 0; window < FOREIGN_SKU_WINDOWS && rows.length < FOREIGN_SKU_RESULTS; window += 1) {
    const snap = await scope.tx.get(after === null ? query : query.startAfter(after));
    rows.push(...await judge(snap.docs.map((doc) => doc.data() as StoredSku).filter(matches(plan))));
    if (snap.size < FOREIGN_SKU_WINDOW) break;
    after = snap.docs[snap.size - 1];
  }
  return rows;
}

/** Τι βλέπει αυτός ο θεατής από όσα ταίριαξαν. */
async function judgeOf(scope: CatalogReadScope, viewer: PricingViewer): Promise<JudgeSkus> {
  const rules = await readVisibilityRules(scope);
  const atMs = Date.parse(scope.now);
  return async (skus) => {
    const rows = await Promise.all(skus.map(async (sku) =>
      foreignSkuRowOf(sku, judgeVisibility(rules, await ancestryOfHolder(scope, sku), viewer, atMs).visibility)));
    return rows.filter((row): row is ForeignSkuRow => row !== null);
  };
}

/** Κρυφό αποτέλεσμα ακριβούς κωδικού πέφτει στις λέξεις, όπως και ο ανύπαρκτος κωδικός: καμία διαφορά προς τα έξω. */
export async function searchCatalogInScope(scope: CatalogReadScope, viewer: PricingViewer, term: string): Promise<readonly ForeignSkuRow[]> {
  const judge = await judgeOf(scope, viewer);
  const exact = await exactRows(scope, term, judge);
  const rows = exact.length > 0 ? exact : await wordRows(scope, catalogSearchPlan(term), judge);
  return rows.slice(0, FOREIGN_SKU_RESULTS);
}
