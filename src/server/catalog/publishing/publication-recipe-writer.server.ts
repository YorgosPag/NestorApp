import 'server-only';

/**
 * Ο **γραφέας συνταγών έκδοσης** (ADR-923 §5.6) — μία συναλλαγή, CAS, ιστορικό, μέσω της μηχανής του καταλόγου.
 * Η **ίδια** επικύρωση με τη φόρμα (`validatePublicationRecipe`)· οι αναφορές (κατηγορίες, λογότυπο, έκδοση τιμών, κοινό)
 * κρίνονται εδώ, απέναντι στα ζωντανά δεδομένα.
 * @module server/catalog/publishing/publication-recipe-writer.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import { unknownFilterKeys } from '@/subapps/catalog/publishing/publication-filter';
import { isPublicationLogo } from '@/subapps/catalog/publishing/publication-logo';
import { validatePublicationRecipe } from '@/subapps/catalog/publishing/validate-publication-recipe';
import { assetFileTypeFactsOf } from '@/subapps/catalog/schema/judge-asset-file';
import type { CatalogAssetDefinition } from '@/subapps/catalog/types/asset';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import type { CatalogCategoryDefinition } from '@/subapps/catalog/types/category';
import type { CatalogFamilyDefinition } from '@/subapps/catalog/types/family';
import type { PublicationRecipeDefinition, PublicationScope, PublicationSelectionEntry } from '@/subapps/catalog/types/publication';
import { readActiveByIds } from '../catalog-library-reads.server';
import {
  assertCodeUnchanged,
  assertRevision,
  readForCreate,
  readOwned,
  runCatalogTransaction,
  stageCreate,
  stageReplace,
  stageSoftDelete,
  type CatalogTx,
  type StoredCatalogRecord,
} from '../catalog-store.server';
import { assertNoIssues } from '../catalog-write-error';
import { assertPublicationPricing } from './publication-prices.server';
import { supersedeRecipeRuns } from './publication-run.server';

export type StoredPublicationRecipe = StoredCatalogRecord<PublicationRecipeDefinition>;

const LOGO_PATH = 'theme.logoAssetId';

/** Το αρχείο του λογότυπου: ο πελάτης λέει μόνο ποιο μέσο θέλει, το τι bytes έχει το κρίνει ο διακομιστής. */
async function logoFileFacts(scope: CatalogTx, fileId: string | null) {
  if (fileId === null) return null;
  const snap = await scope.tx.get(scope.db.collection(COLLECTIONS[FILE_COLLECTION.company]).doc(fileId));
  return snap.exists ? assetFileTypeFactsOf(snap.data() ?? {}) : null;
}

async function assertLogo(scope: CatalogTx, logoId: string | null): Promise<void> {
  if (logoId === null) return;
  const asset = (await readActiveByIds<CatalogAssetDefinition>(scope, 'asset', [logoId])).get(logoId);
  if (!asset) {
    assertNoIssues([{ code: 'unknownReference', path: LOGO_PATH }]);
    return;
  }
  const file = await logoFileFacts(scope, asset.fileId);
  assertNoIssues(isPublicationLogo(asset, file) ? [] : [{ code: 'publicationLogoNotEligible', path: LOGO_PATH }]);
}

/** Κάθε επιλογή δείχνει σε ζωντανό μοντέλο ή SKU του χώρου: ξένο id ≡ ανύπαρκτο. */
async function assertSelection(scope: CatalogTx, publicationScope: PublicationScope): Promise<void> {
  if (publicationScope.kind !== 'selection') return;
  const { entries } = publicationScope;
  const idsOf = (kind: PublicationSelectionEntry['kind']) => entries.filter((entry) => entry.kind === kind).map((entry) => entry.id);
  const models = await readActiveByIds(scope, 'productModel', idsOf('productModel'));
  const products = await readActiveByIds(scope, 'product', idsOf('product'));
  assertNoIssues(entries.flatMap((entry, index) => ((entry.kind === 'productModel' ? models : products).has(entry.id) ? [] : [{ code: 'unknownReference' as const, path: `scope.entries[${index}]` }])));
}

/** Η οικογένεια του φίλτρου είναι ζωντανή και προσφέρει ακόμη κάθε τιμή του. Το πού περνά ένα προϊόν το κρίνει το στιγμιότυπο. */
async function assertFilter(scope: CatalogTx, publicationScope: PublicationScope): Promise<void> {
  if (publicationScope.kind !== 'filter') return;
  const { filter } = publicationScope;
  const family = filter.familyId === null ? undefined : (await readActiveByIds<CatalogFamilyDefinition>(scope, 'family', [filter.familyId])).get(filter.familyId);
  if (!family) {
    assertNoIssues([{ code: 'unknownReference', path: 'scope.filter.familyId' }]);
    return;
  }
  const attributes = await readActiveByIds<CatalogAttributeDefinition>(scope, 'attribute', family.attributes.map((binding) => binding.attributeId));
  const unknown = new Set(unknownFilterKeys(filter, family, attributes));
  assertNoIssues(filter.facetGroups.flatMap((group, groupIndex) => group.keys.flatMap((key, keyIndex) => (unknown.has(key) ? [{ code: 'unknownReference' as const, path: `scope.filter.facetGroups[${groupIndex}].keys[${keyIndex}]` }] : []))));
}

async function assertReferences(scope: CatalogTx, definition: PublicationRecipeDefinition): Promise<void> {
  const categoryIds = definition.scope.kind === 'categories' ? definition.scope.categoryIds : [];
  const categories = await readActiveByIds<CatalogCategoryDefinition>(scope, 'category', categoryIds);
  assertNoIssues(categoryIds.flatMap((id, index) => (categories.has(id) ? [] : [{ code: 'unknownReference' as const, path: `scope.categoryIds[${index}]` }])));
  await assertSelection(scope, definition.scope);
  await assertFilter(scope, definition.scope);
  await assertLogo(scope, definition.theme.logoAssetId);
}

export async function createPublicationRecipe(ctx: AuthContext, definition: PublicationRecipeDefinition): Promise<StoredPublicationRecipe> {
  assertNoIssues(validatePublicationRecipe(definition));
  return runCatalogTransaction(ctx, async (scope) => {
    const target = await readForCreate(scope, 'publicationRecipe', definition.code);
    await assertReferences(scope, definition);
    await assertPublicationPricing(scope, definition.pricing);
    return stageCreate(scope, 'publicationRecipe', target, definition);
  });
}

export async function updatePublicationRecipe(ctx: AuthContext, id: string, expectedRevision: number, definition: PublicationRecipeDefinition): Promise<StoredPublicationRecipe> {
  assertNoIssues(validatePublicationRecipe(definition));
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<PublicationRecipeDefinition>(scope, 'publicationRecipe', id);
    assertRevision(current, expectedRevision);
    assertCodeUnchanged(current, definition.code);
    await assertReferences(scope, definition);
    await assertPublicationPricing(scope, definition.pricing);
    return stageReplace(scope, 'publicationRecipe', current, definition);
  });
}

/** Χωρίς συνταγή δεν έρχεται νεότερη έκδοση: η διαγραφή ξεκινά το ρολόι όλων, αλλιώς η τελευταία θα έμενε για πάντα. */
export async function deletePublicationRecipe(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredPublicationRecipe> {
  const deleted = await runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<PublicationRecipeDefinition>(scope, 'publicationRecipe', id);
    assertRevision(current, expectedRevision);
    return stageSoftDelete(scope, 'publicationRecipe', current);
  });
  await supersedeRecipeRuns(ctx.companyId, id, null, ctx.uid);
  return deleted;
}
