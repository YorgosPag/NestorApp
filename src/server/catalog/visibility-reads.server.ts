import 'server-only';

/**
 * Οι **αναγνώσεις της ορατότητας** μέσα στη συναλλαγή (ADR-923 §5.12 Δ4): οι κανόνες του χώρου και η θέση ενός SKU στον
 * κατάλογο. Ίδια συναλλαγή με την τιμή, άρα η κρίση και το ποσό είναι το ίδιο στιγμιότυπο.
 *
 * Κατηγορίες: το SKU κληρονομεί **και** προσθέτει (ένωση, Akeneo)· κάθε κατηγορία φέρνει και τους προγόνους της.
 * @module server/catalog/visibility-reads.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { StoredVisibilityRule } from '@/subapps/catalog/pricing/visibility';
import type { CatalogCategoryDefinition } from '@/subapps/catalog/types/category';
import type { CatalogProductDefinition, CatalogProductModelDefinition } from '@/subapps/catalog/types/product';
import type { VisibilityAncestry, VisibilityRuleDefinition } from '@/subapps/catalog/types/visibility-rule';
import { readActiveByIds } from './catalog-library-reads.server';
import { readOwnedOrNull, type CatalogTx, type StoredCatalogRecord } from './catalog-store.server';

export async function readVisibilityRules(scope: CatalogTx): Promise<readonly StoredVisibilityRule[]> {
  const snap = await scope.tx.get(
    scope.db
      .collection(COLLECTIONS.CATALOG_VISIBILITY_RULES)
      .where('companyId', '==', scope.ctx.companyId)
      .where('isDeleted', '==', false),
  );
  return snap.docs.map((doc) => {
    const { id, subject, audience, visibility } = doc.data() as StoredCatalogRecord<VisibilityRuleDefinition>;
    return { id, subject, audience, visibility };
  });
}

/** Τα μοντέλα του SKU, από τη ρίζα προς το άμεσο μοντέλο (το πολύ δύο επίπεδα, §5.10). */
async function readModelChain(scope: CatalogTx, modelId: string | null): Promise<readonly StoredCatalogRecord<CatalogProductModelDefinition>[]> {
  const chain: StoredCatalogRecord<CatalogProductModelDefinition>[] = [];
  for (let next = modelId; next !== null; ) {
    const model = await readOwnedOrNull<CatalogProductModelDefinition>(scope, 'productModel', next);
    if (model === null) break;
    chain.unshift(model);
    next = model.parentId;
  }
  return chain;
}

async function readCategoryDepths(scope: CatalogTx, categoryIds: readonly string[]): Promise<Readonly<Record<string, number>>> {
  const categories = await readActiveByIds<CatalogCategoryDefinition>(scope, 'category', categoryIds);
  const depths: Record<string, number> = {};
  for (const [id, category] of categories) {
    category.ancestorIds.forEach((ancestorId, depth) => {
      depths[ancestorId] = depth;
    });
    depths[id] = category.ancestorIds.length;
  }
  return depths;
}

/** Η θέση του SKU· `null` ⇒ ανύπαρκτο, διαγραμμένο ή ξένο: ίδια απάντηση (ADR-742 §3.3). */
export async function readVisibilityAncestry(scope: CatalogTx, variantId: string): Promise<VisibilityAncestry | null> {
  const product = await readOwnedOrNull<CatalogProductDefinition>(scope, 'product', variantId);
  if (product === null) return null;
  const models = await readModelChain(scope, product.modelId);
  const categoryIds = [...product.categoryIds, ...models.flatMap((model) => model.categoryIds)];
  return { variantId, modelIds: models.map((model) => model.id), categoryDepths: await readCategoryDepths(scope, categoryIds) };
}
