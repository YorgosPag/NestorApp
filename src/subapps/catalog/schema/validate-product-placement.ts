/**
 * =============================================================================
 * «ΠΟΥ ΣΤΕΚΕΤΑΙ ΑΥΤΟΣ Ο ΦΟΡΕΑΣ;» — σχήμα, βάθος, γονέας (ADR-923 §5.10 Δ1 · Δ2)
 * =============================================================================
 *
 * Πριν από οποιαδήποτε τιμή: σε ποιο σχήμα παραλλαγών ανήκει το μοντέλο/SKU και σε ποιο
 * **βάθος** — γιατί αυτό λέει **ποιες** ιδιότητες κατέχει. Ο γραφέας καλεί αυτό, παίρνει την
 * τοποθέτηση και μόνο τότε επικυρώνει τις τιμές (`validate-product-values.ts`).
 *
 * | Φορέας | Γονέας | Σχήμα | Βάθος |
 * |---|---|---|---|
 * | μοντέλο-ρίζα | — | οποιοδήποτε | 0 |
 * | υπο-μοντέλο | μοντέλο-**ρίζα** | 2 επιπέδων | 1 |
 * | SKU | μοντέλο-ρίζα | 1 επιπέδου | 1 |
 * | SKU | υπο-μοντέλο | 2 επιπέδων | 2 |
 * | απλό προϊόν | — | κανένα | 0 |
 *
 * Ίδια οικογένεια και ίδιο σχήμα σε όλη την αλυσίδα (Akeneo: η παραλλαγή δεν αλλάζει family variant).
 *
 * @module subapps/catalog/schema/validate-product-placement
 */

import type { CatalogFamilyDefinition, VariantScheme } from '../types/family';
import type { CatalogProductDefinition, CatalogProductModelDefinition } from '../types/product';
import { findVariantScheme } from '../values/attribute-levels';
import { CATALOG_LIMITS, isCatalogCode } from '../vocabulary/catalog-limits';
import { IssueCollector, type CatalogIssue } from './catalog-issues';

export interface Placement {
  readonly scheme: VariantScheme | null;
  readonly depth: number;
}

export interface PlacementResult {
  readonly issues: readonly CatalogIssue[];
  /** `null` όταν η τοποθέτηση είναι άκυρη — τότε οι τιμές **δεν** κρίνονται (θα έδιναν ψευδή ευρήματα). */
  readonly placement: Placement | null;
}

type ModelLink = Pick<CatalogProductModelDefinition, 'familyId' | 'variantSchemeCode' | 'parentId'>;

function result(collector: IssueCollector, placement: Placement | null): PlacementResult {
  return { issues: collector.issues, placement: collector.ok ? placement : null };
}

/** Τοποθέτηση μοντέλου (ρίζα ή υπο-μοντέλο). `parent` = ο ορισμός του γονέα, αν `parentId` ≠ null. */
export function placeProductModel(
  model: CatalogProductModelDefinition,
  parent: ModelLink | null,
  family: CatalogFamilyDefinition,
): PlacementResult {
  const collector = new IssueCollector();
  if (!isCatalogCode(model.code)) collector.add('invalidCode', 'code');
  const scheme = findVariantScheme(family.variantSchemes, model.variantSchemeCode);
  if (!scheme) collector.add('variantSchemeUnknown', 'variantSchemeCode', { code: model.variantSchemeCode });
  if (model.parentId === null) return result(collector, { scheme: scheme ?? null, depth: 0 });
  if (!parent) {
    collector.add('unknownReference', 'parentId');
    return result(collector, null);
  }
  if (parent.familyId !== model.familyId || parent.variantSchemeCode !== model.variantSchemeCode) {
    collector.add('familyMismatch', 'parentId');
  }
  if (parent.parentId !== null || (scheme && scheme.levels.length !== 2)) {
    collector.add('modelHierarchyInvalid', 'parentId');
  }
  return result(collector, { scheme: scheme ?? null, depth: 1 });
}

/** Τοποθέτηση SKU. `model` = ο ορισμός του άμεσου μοντέλου, αν `modelId` ≠ null. */
export function placeProduct(
  product: CatalogProductDefinition,
  model: ModelLink | null,
  family: CatalogFamilyDefinition,
): PlacementResult {
  const collector = new IssueCollector();
  if (product.modelId === null) return result(collector, { scheme: null, depth: 0 });
  if (!model) {
    collector.add('unknownReference', 'modelId');
    return result(collector, null);
  }
  if (model.familyId !== product.familyId) collector.add('familyMismatch', 'familyId');
  const scheme = findVariantScheme(family.variantSchemes, model.variantSchemeCode);
  if (!scheme) {
    collector.add('variantSchemeUnknown', 'modelId', { code: model.variantSchemeCode });
    return result(collector, null);
  }
  const expectedLevels = model.parentId === null ? 1 : 2;
  if (scheme.levels.length !== expectedLevels) collector.add('modelHierarchyInvalid', 'modelId');
  return result(collector, { scheme, depth: scheme.levels.length });
}

/**
 * Χωράνε `added` νέοι απόγονοι κάτω από μοντέλο που έχει ήδη `existing`; (δέσμη σε **μία**
 * συναλλαγή — `CATALOG_LIMITS.maxDescendantsPerModel`).
 */
export function checkDescendantBudget(existing: number, added: number): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  if (existing + added > CATALOG_LIMITS.maxDescendantsPerModel) {
    collector.add('tooManyDescendants', 'variants', { max: CATALOG_LIMITS.maxDescendantsPerModel });
  }
  return collector.issues;
}
