/**
 * **Τα facets μιας οικογένειας** — τι φιλτράρει η λίστα (ADR-923 §5.10 Δ11, §5.10.4 Β2). Καθαρό.
 *
 * Τα κλειδιά παράγονται από τις **ίδιες** συναρτήσεις που τα γράφει ο διακομιστής στο `derived.facetKeys`
 * (`optionFacetKey` · `booleanFacetKey`) — φίλτρο και παράγωγο δεν μπορούν να αποκλίνουν. Facets έχουν μόνο
 * επιλογή · πολλαπλή επιλογή · ναι/όχι (ό,τι το `facetKeysOf` ευρετηριάζει).
 *
 * @module components/catalog/products/product-facets
 */

import type { LocalizedText } from '@/i18n/localized-text';
import { booleanFacetKey, optionFacetKey } from '@/subapps/catalog/derived/holder-derived';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import type { CatalogFamilyDefinition } from '@/subapps/catalog/types/family';

export type FacetValue =
  | { readonly kind: 'option'; readonly key: string; readonly code: string; readonly labels: LocalizedText }
  | { readonly kind: 'boolean'; readonly key: string; readonly value: boolean };

export interface FacetGroup {
  readonly attributeId: string;
  readonly code: string;
  readonly labels: LocalizedText;
  readonly values: readonly FacetValue[];
}

function valuesOf(attribute: CatalogAttributeDefinition, id: string): FacetValue[] {
  switch (attribute.type) {
    case 'select':
    case 'multiSelect':
      return attribute.config.options.map((option) => ({ kind: 'option', key: optionFacetKey(id, option.code), code: option.code, labels: option.labels }));
    case 'boolean':
      return [true, false].map((value) => ({ kind: 'boolean', key: booleanFacetKey(id, value), value }));
    default:
      return [];
  }
}

/** Οι ομάδες facets με τη σειρά των ιδιοτήτων της οικογένειας. */
export function facetGroupsOf(family: CatalogFamilyDefinition, attributes: ReadonlyMap<string, CatalogAttributeDefinition>): FacetGroup[] {
  return family.attributes.flatMap((binding) => {
    const attribute = attributes.get(binding.attributeId);
    if (!attribute) return [];
    const values = valuesOf(attribute, binding.attributeId);
    return values.length === 0 ? [] : [{ attributeId: binding.attributeId, code: attribute.code, labels: attribute.labels, values }];
  });
}

/** Εναλλαγή ενός facet· **ένα** ανά ιδιότητα (Akeneo: «ίσο με» μία τιμή ανά φίλτρο). Η σειρά = σειρά επιλογής. */
export function toggleFacet(selected: readonly string[], group: FacetGroup, key: string): string[] {
  const others = selected.filter((current) => !group.values.some((value) => value.key === current));
  return selected.includes(key) ? others : [...others, key];
}
