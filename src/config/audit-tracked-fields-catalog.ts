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

export const CATALOG_FAMILY_TRACKED_FIELDS = defs(
  ['labelAttributeId', 'imageAttributeId', 'isDeleted'],
  ['labels', 'description', 'attributes', 'variantSchemes', 'tableSpec', 'consistencyRules'],
);
