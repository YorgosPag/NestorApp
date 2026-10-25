/**
 * =============================================================================
 * ΤΟ ΔΕΝΤΡΟ ΚΑΤΗΓΟΡΙΩΝ — καθαρές πράξεις (ADR-923 §5.2)
 * =============================================================================
 *
 * Τοποθέτηση/μετακίνηση κόμβου: γονέας που υπάρχει, **κανένας κύκλος** (κόμβος κάτω από
 * τον εαυτό του ή απόγονό του), **όριο βάθους** για ολόκληρο το υποδέντρο που μετακινείται,
 * και ο νέος `ancestorIds` κάθε απογόνου — υπολογισμένα εδώ, γραμμένα από τον γραφέα σε
 * **μία** συναλλαγή.
 *
 * @module subapps/catalog/schema/category-tree
 */

import type { CatalogCategoryDefinition } from '../types/category';
import { CATALOG_LIMITS } from '../vocabulary/catalog-limits';
import { IssueCollector, type CatalogIssue } from './catalog-issues';

/** Κόμβος όπως τον βλέπουν οι πράξεις του δέντρου. */
export type CategoryNode = Pick<CatalogCategoryDefinition, 'parentId' | 'ancestorIds'> & { readonly id: string };

/** Οι απόγονοι ενός κόμβου (όλα τα επίπεδα), μέσω του `ancestorIds`. */
export function descendantsOf(categoryId: string, all: readonly CategoryNode[]): CategoryNode[] {
  return all.filter((node) => node.ancestorIds.includes(categoryId));
}

/** Ύψος υποδέντρου κάτω από τον κόμβο (0 = φύλλο). */
export function subtreeHeight(node: CategoryNode, all: readonly CategoryNode[]): number {
  const baseDepth = node.ancestorIds.length;
  return descendantsOf(node.id, all).reduce(
    (height, descendant) => Math.max(height, descendant.ancestorIds.length - baseDepth),
    0,
  );
}

/** Οι πρόγονοι ενός νέου παιδιού του `parent` (ρίζα → γονέας). */
export function ancestorsUnder(parent: CategoryNode | null): string[] {
  return parent === null ? [] : [...parent.ancestorIds, parent.id];
}

/**
 * Επικυρώνει ότι ο `node` (ή ένας **νέος** κόμβος, όταν `node === null`) μπορεί να μπει
 * κάτω από τον `parentId`.
 */
export function validateCategoryPlacement(
  node: CategoryNode | null,
  parentId: string | null,
  all: readonly CategoryNode[],
): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  const parent = parentId === null ? null : all.find((candidate) => candidate.id === parentId);
  if (parent === undefined) {
    collector.add('categoryParentUnknown', 'parentId');
    return collector.issues;
  }
  if (node !== null && parent !== null && (parent.id === node.id || parent.ancestorIds.includes(node.id))) {
    collector.add('categoryCycle', 'parentId');
    return collector.issues;
  }
  const newDepth = ancestorsUnder(parent).length;
  const height = node === null ? 0 : subtreeHeight(node, all);
  if (newDepth + height > CATALOG_LIMITS.maxCategoryDepth) {
    collector.add('categoryDepthExceeded', 'parentId', { max: CATALOG_LIMITS.maxCategoryDepth });
  }
  return collector.issues;
}

/**
 * Ο νέος `ancestorIds` του κόμβου **και κάθε απογόνου του** μετά τη μετακίνηση κάτω από
 * τον `newParent`. Κρατά το τμήμα κάτω από τον κόμβο, αλλάζει το πρόθεμα.
 */
export function rebaseSubtree(
  node: CategoryNode,
  newParent: CategoryNode | null,
  all: readonly CategoryNode[],
): ReadonlyMap<string, string[]> {
  const nodeAncestors = ancestorsUnder(newParent);
  const result = new Map<string, string[]>([[node.id, nodeAncestors]]);
  const oldPrefixLength = node.ancestorIds.length;
  for (const descendant of descendantsOf(node.id, all)) {
    result.set(descendant.id, [...nodeAncestors, ...descendant.ancestorIds.slice(oldPrefixLength)]);
  }
  return result;
}
