/**
 * **Το φίλτρο ως εύρος έκδοσης** (ADR-923 §5.6 · §5.6.1) — καθαρό, κοινό σε φόρμα, γραφέα, στιγμιότυπο και κλειδί ιδεμποτίας.
 *
 * Το φίλτρο ζει **μέσα στη συνταγή**, όπως τα φίλτρα στο προφίλ εξαγωγής του Akeneo: η συνταγή είναι το αποθηκευμένο αντικείμενο.
 * Κρίνεται όταν ζητηθεί η έκδοση, άρα νέο προϊόν που ταιριάζει μπαίνει μόνο του στην επόμενη.
 *
 * 🔑 **Μία κρίση**: το `keysMatchSelection` πάνω στα `derived.facetKeys`, ό,τι ρωτά και η οθόνη προϊόντων. Το AND ισχύει στο ίδιο
 *    SKU, και σε μοντέλο τυπώνονται **μόνο** οι παραλλαγές που περνούν.
 * ⚠️ **Σχήμα αποθήκευσης**: η Firestore δεν αποθηκεύει πίνακα μέσα σε πίνακα, ενώ το `FacetSelection` της οθόνης είναι ακριβώς
 *    αυτό. Γι' αυτό κάθε ομάδα γράφεται ως αντικείμενο `{ keys }`, και η μετατροπή ζει μόνο εδώ.
 * 🔑 **Κανονική μορφή**: ίδια επιλογή με άλλη σειρά κλικ δίνει το ίδιο hash, άρα το ίδιο αρχείο.
 * @module subapps/catalog/publishing/publication-filter
 */

import { keysMatchSelection, type FacetSelection } from '../list/catalog-list-query';
import { facetGroupsOf } from '../list/product-facets';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { CatalogFamilyDefinition } from '../types/family';
import type { PublicationFilter, PublicationRecipeDefinition } from '../types/publication';

export const EMPTY_PUBLICATION_FILTER: PublicationFilter = { familyId: null, facetGroups: [] };

export function facetSelectionOf(filter: PublicationFilter): FacetSelection {
  return filter.facetGroups.map((group) => group.keys);
}

/** Ταξινομημένα κλειδιά και ομάδες, χωρίς άδειες: η άδεια ομάδα θα απέκλειε τα πάντα. */
export function filterWithSelection(filter: PublicationFilter, selection: FacetSelection): PublicationFilter {
  const groups = selection.filter((keys) => keys.length > 0).map((keys) => [...new Set(keys)].sort());
  const facetGroups = groups.sort((a, b) => a[0].localeCompare(b[0])).map((keys) => ({ keys }));
  return { familyId: filter.familyId, facetGroups };
}

/** Η συνταγή όπως τη βλέπει το κλειδί ιδεμποτίας. Κάθε άλλο εύρος επιστρέφει το ίδιο αντικείμενο, άρα και το ίδιο hash με πριν. */
export function canonicalRecipeScope(recipe: PublicationRecipeDefinition): PublicationRecipeDefinition {
  if (recipe.scope.kind !== 'filter') return recipe;
  const { filter } = recipe.scope;
  return { ...recipe, scope: { kind: 'filter', filter: filterWithSelection(filter, facetSelectionOf(filter)) } };
}

export function productPassesFilter(product: { readonly familyId: string; readonly derived: { readonly facetKeys?: readonly string[] } }, filter: PublicationFilter): boolean {
  return product.familyId === filter.familyId && keysMatchSelection(product.derived.facetKeys ?? [], facetSelectionOf(filter));
}

/** Τα κλειδιά του φίλτρου που η οικογένεια δεν προσφέρει πια: διαγράφηκε ιδιότητα ή επιλογή, ή βγήκε από την οικογένεια. */
export function unknownFilterKeys(
  filter: PublicationFilter,
  family: CatalogFamilyDefinition,
  attributes: ReadonlyMap<string, CatalogAttributeDefinition>,
): readonly string[] {
  const known = new Set(facetGroupsOf(family, attributes).flatMap((group) => group.values.map((value) => value.key)));
  return filter.facetGroups.flatMap((group) => group.keys).filter((key) => !known.has(key));
}
