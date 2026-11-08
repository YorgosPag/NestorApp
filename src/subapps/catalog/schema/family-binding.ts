/**
 * Το **δέσιμο ιδιότητας σε οικογένεια** (ADR-923 §5.2 · §5.5.2 Β3 Γ7) — καθαρές συναρτήσεις, ένα σημείο για τον επεξεργαστή
 * οικογένειας και για την εισαγωγή.
 *
 * 🔑 Η θέση στο σχήμα παραλλαγών **είναι** το επίπεδο της τιμής: ιδιότητα δεμένη μόνο στην οικογένεια έχει βάθος 0, δηλαδή είναι κοινή
 *    στο μοντέλο. Γραμμή πηγής με διαφορετική τιμή ανά παραλλαγή πρέπει να μπει στο **τελευταίο** επίπεδο, αλλιώς κάθε τιμή της γίνεται
 *    «διαφωνία κοινού».
 * @module subapps/catalog/schema/family-binding
 */

import { listingKindOf, type CatalogFamilyDefinition, type VariantScheme } from '../types/family';

/**
 * Ο **ορισμός** μιας οικογένειας χωρίς περίβλημα εγγραφής και χωρίς παράγωγα (`attributeIds`, id, αναθεώρηση). Κανονικοποιεί τα πεδία
 * της §22: παλιά εγγραφή χωρίς αυτά δεν πρέπει να φαίνεται αλλαγμένη. Ένα σημείο για τον επεξεργαστή και για τον διακομιστή.
 */
export function familyDefinitionOf(record: CatalogFamilyDefinition): CatalogFamilyDefinition {
  const { code, labels, description, attributes, labelAttributeId, imageAttributeId, variantSchemes, tableSpec, consistencyRules } = record;
  const listing = { listingKind: listingKindOf(record), installationAttributeId: record.installationAttributeId ?? null, etimClass: record.etimClass ?? null };
  return { code, labels, description, attributes, labelAttributeId, imageAttributeId, variantSchemes, tableSpec, consistencyRules, ...listing };
}

/** Η ιδιότητα σε **ένα** επίπεδο (δείκτης ως κείμενο), ή σε κανένα (κοινή). Από τα άλλα επίπεδα φεύγει. */
export function placeAttribute(scheme: VariantScheme, attributeId: string, column: string): VariantScheme {
  return {
    ...scheme,
    levels: scheme.levels.map((level, index) => {
      const rest = level.attributeIds.filter((id) => id !== attributeId);
      return { ...level, attributeIds: String(index) === column ? [...rest, attributeId] : rest };
    }),
  };
}

/** Δένει ιδιότητες που λείπουν από την οικογένεια, χωρίς απαιτούμενα κανάλια. Όσες είναι ήδη δεμένες μένουν όπως είναι. */
export function withBoundAttributes(family: CatalogFamilyDefinition, attributeIds: readonly string[]): CatalogFamilyDefinition {
  const bound = new Set(family.attributes.map((binding) => binding.attributeId));
  const added = [...new Set(attributeIds)].filter((id) => !bound.has(id)).map((attributeId) => ({ attributeId, requiredChannels: [] }));
  return added.length === 0 ? family : { ...family, attributes: [...family.attributes, ...added] };
}

/**
 * Δένει την ιδιότητα και, για `leaf`, την τοποθετεί στο τελευταίο επίπεδο του σχήματος `schemeCode`. Χωρίς σχήμα δεν υπάρχει επίπεδο:
 * κάθε τιμή ανήκει στο τελικό προϊόν. Ιδεμπότητη: δεύτερη κλήση δεν αλλάζει τίποτα.
 */
export function withAttributeAtLevel(
  family: CatalogFamilyDefinition,
  attributeId: string,
  level: 'shared' | 'leaf',
  schemeCode: string | null,
): CatalogFamilyDefinition {
  const bound = withBoundAttributes(family, [attributeId]);
  if (level === 'shared' || schemeCode === null) return bound;
  return {
    ...bound,
    variantSchemes: bound.variantSchemes.map((scheme) =>
      scheme.code === schemeCode && scheme.levels.length > 0 ? placeAttribute(scheme, attributeId, String(scheme.levels.length - 1)) : scheme,
    ),
  };
}
