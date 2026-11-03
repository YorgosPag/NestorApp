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
import type { InheritanceLink } from '@/subapps/catalog/values/resolve-inherited';
import { readActiveByIds } from './catalog-library-reads.server';
import { readOwnedOrNull, type CatalogReadScope, type StoredCatalogRecord } from './catalog-store.server';

export async function readVisibilityRules(scope: CatalogReadScope): Promise<readonly StoredVisibilityRule[]> {
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
async function readModelChain(scope: CatalogReadScope, modelId: string | null): Promise<readonly StoredCatalogRecord<CatalogProductModelDefinition>[]> {
  const chain: StoredCatalogRecord<CatalogProductModelDefinition>[] = [];
  for (let next = modelId; next !== null; ) {
    const model = await readOwnedOrNull<CatalogProductModelDefinition>(scope, 'productModel', next);
    if (model === null) break;
    chain.unshift(model);
    next = model.parentId;
  }
  return chain;
}

/** Κάθε κατηγορία φέρνει και τους προγόνους της. Καθαρή: η προβολή μοντέλου διαβάζει μία φορά και κρίνει ανά SKU. */
function categoryDepthsOf(categories: ReadonlyMap<string, CatalogCategoryDefinition>, categoryIds: readonly string[]): Readonly<Record<string, number>> {
  const depths: Record<string, number> = {};
  for (const id of new Set(categoryIds)) {
    const category = categories.get(id);
    if (category === undefined) continue;
    category.ancestorIds.forEach((ancestorId, depth) => {
      depths[ancestorId] = depth;
    });
    depths[id] = category.ancestorIds.length;
  }
  return depths;
}

async function readCategoryDepths(scope: CatalogReadScope, categoryIds: readonly string[]): Promise<Readonly<Record<string, number>>> {
  return categoryDepthsOf(await readActiveByIds<CatalogCategoryDefinition>(scope, 'category', categoryIds), categoryIds);
}

/** Ό,τι χρειάζεται η θέση από το SKU: ο αναγνώστης της λίστας το έχει ήδη, και δεν το ξαναδιαβάζει. */
export type VisibilityHolder = Pick<StoredCatalogRecord<CatalogProductDefinition>, 'id' | 'modelId' | 'categoryIds'>;

export async function ancestryOfHolder(scope: CatalogReadScope, holder: VisibilityHolder): Promise<VisibilityAncestry> {
  const models = await readModelChain(scope, holder.modelId);
  const categoryIds = [...holder.categoryIds, ...models.flatMap((model) => model.categoryIds)];
  return { variantId: holder.id, modelIds: models.map((model) => model.id), categoryDepths: await readCategoryDepths(scope, categoryIds) };
}

/** Η ίδια θέση όταν αλυσίδα και κατηγορίες είναι ήδη διαβασμένες. 🔒 Μόνο οι κατηγορίες της **δικής του** αλυσίδας, όχι των αδελφών. */
export function ancestryOfChain(holderId: string, chain: readonly InheritanceLink[], categories: ReadonlyMap<string, CatalogCategoryDefinition>): VisibilityAncestry {
  const categoryIds = chain.flatMap((link) => link.holder.categoryIds);
  return { variantId: holderId, modelIds: chain.filter((link) => link.kind === 'productModel').map((link) => link.id), categoryDepths: categoryDepthsOf(categories, categoryIds) };
}

/** Η θέση του SKU· `null` ⇒ ανύπαρκτο, διαγραμμένο ή ξένο: ίδια απάντηση (ADR-742 §3.3). */
export async function readVisibilityAncestry(scope: CatalogReadScope, variantId: string): Promise<VisibilityAncestry | null> {
  const product = await readOwnedOrNull<CatalogProductDefinition>(scope, 'product', variantId);
  return product === null ? null : ancestryOfHolder(scope, product);
}
