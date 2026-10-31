import 'server-only';

/**
 * Ο **γραφέας συνταγών έκδοσης** (ADR-923 §5.6) — μία συναλλαγή, CAS, ιστορικό, μέσω της μηχανής του καταλόγου.
 * Η **ίδια** επικύρωση με τη φόρμα (`validatePublicationRecipe`)· οι αναφορές (κατηγορίες, λογότυπο, έκδοση τιμών, κοινό)
 * κρίνονται εδώ, απέναντι στα ζωντανά δεδομένα.
 * @module server/catalog/publishing/publication-recipe-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import { validatePublicationRecipe } from '@/subapps/catalog/publishing/validate-publication-recipe';
import type { CatalogAssetDefinition } from '@/subapps/catalog/types/asset';
import type { CatalogCategoryDefinition } from '@/subapps/catalog/types/category';
import type { PublicationRecipeDefinition } from '@/subapps/catalog/types/publication';
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

export type StoredPublicationRecipe = StoredCatalogRecord<PublicationRecipeDefinition>;

async function assertReferences(scope: CatalogTx, definition: PublicationRecipeDefinition): Promise<void> {
  const categoryIds = definition.scope.kind === 'categories' ? definition.scope.categoryIds : [];
  const categories = await readActiveByIds<CatalogCategoryDefinition>(scope, 'category', categoryIds);
  assertNoIssues(categoryIds.flatMap((id, index) => (categories.has(id) ? [] : [{ code: 'unknownReference' as const, path: `scope.categoryIds[${index}]` }])));
  const logoId = definition.theme.logoAssetId;
  if (logoId !== null) {
    const assets = await readActiveByIds<CatalogAssetDefinition>(scope, 'asset', [logoId]);
    assertNoIssues(assets.has(logoId) ? [] : [{ code: 'unknownReference', path: 'theme.logoAssetId' }]);
  }
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

export async function deletePublicationRecipe(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredPublicationRecipe> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<PublicationRecipeDefinition>(scope, 'publicationRecipe', id);
    assertRevision(current, expectedRevision);
    return stageSoftDelete(scope, 'publicationRecipe', current);
  });
}
