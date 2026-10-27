/**
 * Τα παρακολουθούμενα πεδία του **σχήματος καταλόγου** (ADR-923 §5.9 · ADR-195) — ποιες αλλαγές
 * αφήνουν ίχνος στο ιστορικό. Χωριστό αρχείο (όπως τα `-dxf-bim` των IDs) ώστε το
 * `audit-tracked-fields.ts` να μη μεγαλώνει· το `getTrackedFieldsForEntityAuditType` απλώς δείχνει εδώ.
 *
 * 🔑 Τα σύνθετα πεδία (ρυθμίσεις τύπου, παραλλαγές, πίνακας, κανόνες) γράφονται ως **κανονικοποιημένο JSON**
 * (`lib/legal/canonical-json`, ταξινομημένα κλειδιά): η προβολή είναι **ταυτότητα** — δύο διαφορετικές τιμές
 * δίνουν διαφορετικό κείμενο, άρα καμία αλλαγή δεν χάνεται, και η ίδια τιμή δίνει **πάντα** το ίδιο κείμενο,
 * άρα καμία ψεύτικη αλλαγή από αλλαγμένη σειρά κλειδιών.
 * Οι ετικέτες των πεδίων ζουν στο namespace `catalog` (`audit.fields.*`).
 *
 * 🔑 **Τιμές προϊόντων: ιστορικό ΑΝΑ ΙΔΙΟΤΗΤΑ** (ADR-923 §5.10 Θωράκιση 6). Ένα JSON ολόκληρου του `values` θα
 * έγραφε «άλλαξε το values» με 14 τιμές πριν και 14 μετά, για μία αλλαγή βάρους. Η μηχανή (`catalog-kinds.ts`)
 * προβάλλει τον χάρτη σε **συλλογή** `[{ attributeId, slots }]` πριν από τη σύγκριση, και η μηχανή ιστορικού
 * (ADR-195 Φ11, `kind: 'collection'`) δίνει **μία** γραμμή ανά ιδιότητα που προστέθηκε / αφαιρέθηκε / άλλαξε —
 * Akeneo versioning ανά ιδιότητα.
 * @module config/audit-tracked-fields-catalog
 */

import type { TrackedFieldDef } from '@/lib/audit/audit-diff';
import { canonicalJson } from '@/lib/legal/canonical-json';

/** Προβολή σύνθετης τιμής σε σταθερό κείμενο ιστορικού. */
function structured(value: unknown): string | null {
  return value === null || value === undefined ? null : canonicalJson(value).trim();
}

const scalar = (field: string): TrackedFieldDef => ({
  kind: 'scalar',
  label: field,
  labelKey: `catalog:audit.fields.${field}`,
});

const complex = (field: string): TrackedFieldDef => ({
  kind: 'scalar',
  label: field,
  labelKey: `catalog:audit.fields.${field}`,
  value: structured,
});

function defs(scalars: readonly string[], complexes: readonly string[]): Record<string, TrackedFieldDef> {
  return Object.fromEntries([
    ...scalars.map((field) => [field, scalar(field)] as const),
    ...complexes.map((field) => [field, complex(field)] as const),
  ]);
}

export const CATALOG_ATTRIBUTE_TRACKED_FIELDS = defs(
  ['type', 'groupId', 'localizable', 'scopable', 'unique', 'orderKey', 'isDeleted'],
  ['labels', 'description', 'config', 'mappings'],
);

export const CATALOG_ATTRIBUTE_GROUP_TRACKED_FIELDS = defs(['orderKey', 'isDeleted'], ['labels']);

export const CATALOG_MEASUREMENT_FAMILY_TRACKED_FIELDS = defs(
  ['standardUnitCode', 'singleUnit', 'isDeleted'],
  ['labels', 'units'],
);

export const CATALOG_CATEGORY_TRACKED_FIELDS = defs(['parentId', 'orderKey', 'isDeleted'], ['labels', 'mappings']);

/** Το όνομα του πεδίου της προβολής ανά ιδιότητα — ένα όνομα για μηχανή και περιγραφέα. */
export const CATALOG_VALUES_AUDIT_FIELD = 'values';

/** Η γραμμή της προβολής: μία ιδιότητα με όλες τις θέσεις της (κανάλι × γλώσσα). */
export interface CatalogValuesAuditRow {
  readonly attributeId: string;
  readonly slots: unknown;
}

/** Χάρτης `values` → συλλογή, με σταθερή σειρά (η σειρά δεν είναι αλλαγή). */
export function catalogValuesAuditRows(values: unknown): CatalogValuesAuditRow[] {
  if (values === null || typeof values !== 'object') return [];
  return Object.entries(values as Record<string, unknown>)
    .map(([attributeId, slots]) => ({ attributeId, slots }))
    .sort((a, b) => a.attributeId.localeCompare(b.attributeId));
}

const valuesByAttribute: TrackedFieldDef = {
  kind: 'collection',
  label: CATALOG_VALUES_AUDIT_FIELD,
  labelKey: `catalog:audit.fields.${CATALOG_VALUES_AUDIT_FIELD}`,
  keyBy: 'attributeId',
  labelFields: ['attributeId'],
  trackSubFields: ['slots'],
  subFieldValues: { slots: (item) => structured(item.slots) },
};

export const CATALOG_FAMILY_TRACKED_FIELDS = defs(
  ['labelAttributeId', 'imageAttributeId', 'isDeleted'],
  ['labels', 'description', 'attributes', 'variantSchemes', 'tableSpec', 'consistencyRules'],
);

// ── Φάση 2 (ADR-923 §5.10) — δεδομένα. Τα παράγωγα (`derived`) ΔΕΝ παρακολουθούνται: τα γράφει ο γραφέας,
//    και ένας επανυπολογισμός πληρότητας δεν είναι «αλλαγή» κανενός ανθρώπου.

export const CATALOG_PRODUCT_MODEL_TRACKED_FIELDS = {
  ...defs(['familyId', 'variantSchemeCode', 'parentId', 'isDeleted'], ['categoryIds', 'noValueReasons']),
  [CATALOG_VALUES_AUDIT_FIELD]: valuesByAttribute,
};

export const CATALOG_PRODUCT_TRACKED_FIELDS = {
  ...defs(['modelId', 'familyId', 'isDeleted'], ['categoryIds', 'noValueReasons']),
  [CATALOG_VALUES_AUDIT_FIELD]: valuesByAttribute,
};

export const CATALOG_ASSET_TRACKED_FIELDS = defs(['role', 'kind', 'fileId', 'isDeleted'], ['labels', 'description', 'rights']);

export const CATALOG_SETTINGS_TRACKED_FIELDS = defs([], ['channelLocales']);

// ── Φάση 3β (ADR-923 §5.11) — τιμοκατάλογοι. Τα παράγωγα (`derived`: `linesRevision`, σπορά, κλειδιά δεικτών) ΔΕΝ
//    παρακολουθούνται. Η σφραγίδα (`seal`) ναι: είναι η **πράξη** της δημοσίευσης, με ποιον φράχτη και τι επιβεβαιώθηκε.

export const CATALOG_PRICE_LIST_TRACKED_FIELDS = defs(['kind', 'priceType', 'changeFenceBp', 'isDeleted'], ['labels', 'audience']);

export const CATALOG_PRICE_LIST_VERSION_TRACKED_FIELDS = defs(
  ['number', 'status', 'validFrom', 'basedOnVersionId', 'isDeleted'],
  ['seal'],
);

export const CATALOG_PRICE_LIST_LINE_TRACKED_FIELDS = defs(
  ['netPrice', 'priceQuantity', 'unitCode', 'discountGroupId', 'isDeleted'],
  ['subject', 'breakdown'],
);

export const CATALOG_DISCOUNT_GROUP_TRACKED_FIELDS = defs(['isDeleted'], ['labels']);

export const CATALOG_CUSTOMER_GROUP_TRACKED_FIELDS = defs(['isDeleted'], ['labels']);

export const CATALOG_CUSTOMER_ASSIGNMENT_TRACKED_FIELDS = defs(['customerGroupId', 'isDeleted'], ['party']);

export const CATALOG_DISCOUNT_CONDITION_TRACKED_FIELDS = defs(
  ['discountGroupId', 'validFrom', 'validUntil', 'isDeleted'],
  ['audience', 'rule'],
);
