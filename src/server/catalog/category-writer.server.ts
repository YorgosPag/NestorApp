import 'server-only';

/**
 * Ο **γραφέας του δέντρου κατηγοριών** (ADR-923 §5.2). Ο `ancestorIds` είναι παράγωγο που γράφει **μόνο**
 * αυτός: στη γέννηση από τον γονέα, στη μετακίνηση για **ολόκληρο** το υποδέντρο μέσα στην **ίδια**
 * συναλλαγή (κανείς δεν βλέπει ποτέ μισομετακινημένο κλάδο). Έλεγχος κύκλου και βάθους υποδέντρου πριν
 * από κάθε εγγραφή (`validateCategoryPlacement`). Η σειρά ανάμεσα στα αδέλφια = fractional `orderKey`:
 * η αναδιάταξη γράφει **ένα** έγγραφο.
 * @module server/catalog/category-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import { hasAnyLocalizedText, type LocalizedText } from '@/i18n/localized-text';
import {
  ancestorsUnder,
  rebaseSubtree,
  validateCategoryPlacement,
  type CategoryNode,
} from '@/subapps/catalog/schema/category-tree';
import type { CatalogCategoryDefinition, CatalogCategoryMappings } from '@/subapps/catalog/types/category';
import { readCategoryDescendants } from './catalog-library-reads.server';
import {
  assertRevision,
  readForCreate,
  readOwned,
  runCatalogTransaction,
  stageCreate,
  stageReplace,
  stageSoftDelete,
  type CatalogTx,
  type StoredCatalogRecord,
} from './catalog-store.server';
import { assertNoIssues, CatalogWriteError } from './catalog-write-error';

type StoredCategory = StoredCatalogRecord<CatalogCategoryDefinition>;

/**
 * Όριο εγγραφών υποδέντρου σε μία μετακίνηση — κάτω από το όριο των 500 εγγραφών ανά συναλλαγή της
 * Firestore, με περιθώριο για τον ίδιο τον κόμβο. Μεγαλύτερος κλάδος μετακινείται σε τμήματα.
 */
const MAX_SUBTREE_MOVE = 450;

export interface CreateCategoryInput {
  readonly code: string;
  readonly labels: LocalizedText;
  readonly parentId: string | null;
  readonly orderKey: string;
  readonly mappings: CatalogCategoryMappings;
}

function assertLabelled(labels: LocalizedText): void {
  assertNoIssues(hasAnyLocalizedText(labels) ? [] : [{ code: 'labelRequired', path: 'labels' }]);
}

async function readParent(scope: CatalogTx, parentId: string | null): Promise<StoredCategory | null> {
  if (parentId === null) return null;
  try {
    return await readOwned<CatalogCategoryDefinition>(scope, 'category', parentId);
  } catch (error) {
    if (error instanceof CatalogWriteError && error.kind === 'notFound') {
      throw new CatalogWriteError('invalid', [{ code: 'categoryParentUnknown', path: 'parentId' }]);
    }
    throw error;
  }
}

export async function createCatalogCategory(ctx: AuthContext, input: CreateCategoryInput): Promise<StoredCategory> {
  assertLabelled(input.labels);
  return runCatalogTransaction(ctx, async (scope) => {
    const target = await readForCreate(scope, 'category', input.code);
    const parent = await readParent(scope, input.parentId);
    assertNoIssues(validateCategoryPlacement(null, input.parentId, parent ? [parent] : []));
    return stageCreate(scope, 'category', target, { ...input, ancestorIds: ancestorsUnder(parent) });
  });
}

export async function updateCatalogCategory(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  patch: { readonly labels: LocalizedText; readonly mappings: CatalogCategoryMappings },
): Promise<StoredCategory> {
  assertLabelled(patch.labels);
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<CatalogCategoryDefinition>(scope, 'category', id);
    assertRevision(current, expectedRevision);
    return stageReplace(scope, 'category', current, { ...current, ...patch });
  });
}

/** Μετακίνηση κάτω από άλλο γονέα (ή στη ρίζα) και/ή αλλαγή θέσης ανάμεσα στα αδέλφια. */
export async function moveCatalogCategory(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  target: { readonly parentId: string | null; readonly orderKey: string },
): Promise<StoredCategory> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<CatalogCategoryDefinition>(scope, 'category', id);
    assertRevision(current, expectedRevision);
    const parent = await readParent(scope, target.parentId);
    const descendants = await readCategoryDescendants(scope, id);
    if (descendants.length > MAX_SUBTREE_MOVE) {
      throw new CatalogWriteError('invalid', [{ code: 'tooMany', path: 'parentId', params: { max: MAX_SUBTREE_MOVE } }]);
    }
    const nodes: CategoryNode[] = [current, ...(parent ? [parent] : []), ...descendants];
    assertNoIssues(validateCategoryPlacement(current, target.parentId, nodes));
    const rebased = rebaseSubtree(current, parent, nodes);
    for (const descendant of descendants) {
      stageReplace(scope, 'category', descendant, {
        ...descendant,
        ancestorIds: rebased.get(descendant.id) ?? descendant.ancestorIds,
      });
    }
    return stageReplace(scope, 'category', current, {
      ...current,
      parentId: target.parentId,
      orderKey: target.orderKey,
      ancestorIds: rebased.get(current.id) ?? ancestorsUnder(parent),
    });
  });
}

export async function deleteCatalogCategory(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredCategory> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<CatalogCategoryDefinition>(scope, 'category', id);
    assertRevision(current, expectedRevision);
    const descendants = await readCategoryDescendants(scope, id);
    if (descendants.length > 0) throw new CatalogWriteError('inUse', [], { children: descendants.length });
    return stageSoftDelete(scope, 'category', current);
  });
}
