/**
 * @fileoverview **Οι πράξεις του δέντρου κατηγοριών, αισιόδοξα** — δημιουργία, μετονομασία, μετακίνηση, διαγραφή
 *   (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/categories/category-actions
 *
 * 🔑 **Η μετακίνηση κρίνεται ΠΡΙΝ φύγει** από τον **ίδιο** επικυρωτή που τρέχει ο γραφέας (`validateCategoryPlacement`:
 *    κύκλος · βάθος υποδέντρου · γονέας που υπάρχει) — το δέντρο αρνείται επί τόπου, με ανακοίνωση, αντί για 422.
 * 🔑 Η μετακίνηση γράφει **ένα** κλειδί σειράς· το υποδέντρο (`ancestorIds`) το ξαναγράφει ο γραφέας στην ίδια
 *    συναλλαγή. Η αισιόδοξη όψη αλλάζει μόνο τον κόμβο — τα παιδιά ακολουθούν μέσω `parentId`.
 */

import type { TreeMove } from '@/components/ui/sortable/sortable-model';
import type { CatalogOptimistic, CatalogOutcome } from '@/hooks/catalog/useCatalogOptimistic';
import type { LocalizedText } from '@/i18n/localized-text';
import {
  createCatalogCategory,
  deleteCatalogCategory,
  moveCatalogCategory,
  updateCatalogCategory,
  type CategoryRecord,
  type CreateCategoryInput,
} from '@/services/catalog/catalog-api.client';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { ancestorsUnder, validateCategoryPlacement } from '@/subapps/catalog/schema/category-tree';
import type { CatalogCategoryMappings } from '@/subapps/catalog/types/category';
import { newEntityKey, optimisticWire } from '../shared/catalog-actions';
import { orderKeyBetween } from '../shared/catalog-ordering';

type Ops = CatalogOptimistic<CategoryRecord>;

/** Κρίση μετακίνησης — τα ίδια ευρήματα που θα έδινε ο γραφέας. */
export function categoryMoveIssues(categories: readonly CategoryRecord[], move: TreeMove): readonly CatalogIssue[] {
  const node = categories.find((category) => category.id === move.id) ?? null;
  return validateCategoryPlacement(node, move.parentId, categories);
}

function parentOf(categories: readonly CategoryRecord[], parentId: string | null): CategoryRecord | null {
  return parentId === null ? null : categories.find((category) => category.id === parentId) ?? null;
}

export function moveCategory(ops: Ops, categories: readonly CategoryRecord[], move: TreeMove): void {
  const node = categories.find((category) => category.id === move.id);
  if (!node) return;
  const orderKey = orderKeyBetween(categories, move);
  const ancestorIds = ancestorsUnder(parentOf(categories, move.parentId));
  ops.submit({
    key: node.id,
    optimistic: { ...node, parentId: move.parentId, orderKey, ancestorIds },
    baseRevision: node.revision,
    send: (revision) => moveCatalogCategory(node.id, revision ?? node.revision, { parentId: move.parentId, orderKey }),
  });
}

type Settled = (outcome: CatalogOutcome<CategoryRecord>) => void;

export function createCategory(ops: Ops, categories: readonly CategoryRecord[], input: CreateCategoryInput, onSettled?: Settled): void {
  const key = newEntityKey(input.code);
  const definition = { ...input, ancestorIds: ancestorsUnder(parentOf(categories, input.parentId)) };
  ops.submit({
    key,
    optimistic: optimisticWire(definition, null, key),
    baseRevision: null,
    send: () => createCatalogCategory(input),
    onSettled,
  });
}

export function updateCategory(
  ops: Ops,
  category: CategoryRecord,
  /** Η αναθεώρηση πάνω στην οποία χτίστηκε η αλλαγή (CAS) — όχι η ζωντανή. */
  baseRevision: number,
  patch: { readonly labels: LocalizedText; readonly mappings: CatalogCategoryMappings },
  onSettled?: Settled,
): void {
  ops.submit({
    key: category.id,
    optimistic: { ...category, ...patch },
    baseRevision,
    send: (revision) => updateCatalogCategory(category.id, revision ?? category.revision, patch),
    onSettled,
  });
}

export function deleteCategory(ops: Ops, category: CategoryRecord): void {
  ops.submit({
    key: category.id,
    optimistic: null,
    baseRevision: category.revision,
    send: (revision) => deleteCatalogCategory(category.id, revision ?? category.revision),
  });
}
