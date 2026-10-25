import 'server-only';

/**
 * Ο **γραφέας ομάδων ιδιοτήτων** (ADR-923 §5.2) — ετικέτα και σειρά αλλάζουν ελεύθερα· ο κωδικός ποτέ·
 * διαγραφή μόνο όταν **καμία** ενεργή ιδιότητα δεν ανήκει στην ομάδα (κάθε ιδιότητα ανήκει σε **μία** ομάδα,
 * άρα μια διαγραμμένη ομάδα θα άφηνε ιδιότητες «χωρίς ενότητα» στην οθόνη και στον εκδότη).
 * @module server/catalog/attribute-group-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import { hasAnyLocalizedText } from '@/i18n/localized-text';
import type { CatalogAttributeGroupDefinition } from '@/subapps/catalog/types/attribute-group';
import { groupHasAttributes } from './catalog-library-reads.server';
import {
  assertCodeUnchanged,
  assertRevision,
  readForCreate,
  readOwned,
  runCatalogTransaction,
  stageCreate,
  stageReplace,
  stageSoftDelete,
  type StoredCatalogRecord,
} from './catalog-store.server';
import { assertNoIssues, CatalogWriteError } from './catalog-write-error';

type StoredGroup = StoredCatalogRecord<CatalogAttributeGroupDefinition>;

function assertLabelled(definition: CatalogAttributeGroupDefinition): void {
  assertNoIssues(hasAnyLocalizedText(definition.labels) ? [] : [{ code: 'labelRequired', path: 'labels' }]);
}

export async function createCatalogAttributeGroup(ctx: AuthContext, definition: CatalogAttributeGroupDefinition): Promise<StoredGroup> {
  assertLabelled(definition);
  return runCatalogTransaction(ctx, async (scope) => {
    const target = await readForCreate(scope, 'attributeGroup', definition.code);
    return stageCreate(scope, 'attributeGroup', target, definition);
  });
}

export async function updateCatalogAttributeGroup(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  definition: CatalogAttributeGroupDefinition,
): Promise<StoredGroup> {
  assertLabelled(definition);
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<CatalogAttributeGroupDefinition>(scope, 'attributeGroup', id);
    assertRevision(current, expectedRevision);
    assertCodeUnchanged(current, definition.code);
    return stageReplace(scope, 'attributeGroup', current, definition);
  });
}

export async function deleteCatalogAttributeGroup(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredGroup> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<CatalogAttributeGroupDefinition>(scope, 'attributeGroup', id);
    assertRevision(current, expectedRevision);
    if (await groupHasAttributes(scope, id)) throw new CatalogWriteError('inUse');
    return stageSoftDelete(scope, 'attributeGroup', current);
  });
}
