/**
 * Οι **κατασκευαστές** παρακολουθούμενων πεδίων ιστορικού (ADR-195) — κοινοί για κάθε τομέα με δικό του namespace
 * ετικετών (κατάλογος ADR-923 · υπεργολαβία ADR-928). Πριν ζούσαν ιδιωτικά στο `audit-tracked-fields-catalog.ts`,
 * καρφωμένοι στο `catalog:`· ο δεύτερος τομέας θα τους αντέγραφε (CHECK 3.28).
 *
 * 🔑 Τα σύνθετα πεδία γράφονται ως **κανονικοποιημένο JSON** (`lib/legal/canonical-json`, ταξινομημένα κλειδιά): ίδια
 * τιμή ⇒ πάντα ίδιο κείμενο (καμία ψεύτικη αλλαγή από σειρά κλειδιών), διαφορετική τιμή ⇒ διαφορετικό κείμενο.
 * @module config/audit-tracked-field-builders
 */

import type { TrackedFieldDef } from '@/lib/audit/audit-diff';
import type { AuditCatalogRef } from '@/config/audit-value-catalogs';
import { canonicalJson } from '@/lib/legal/canonical-json';

/** Προβολή σύνθετης τιμής σε σταθερό κείμενο ιστορικού. */
export function structuredAuditValue(value: unknown): string | null {
  return value === null || value === undefined ? null : canonicalJson(value).trim();
}

/**
 * Το **λεξιλόγιο** των τιμών ενός πεδίου (ADR-852 §4 · ADR-923 §23.5 Β1): ποιος κατάλογος λέει τη λέξη μιας απαρίθμησης
 * (`enumCatalog`), τα ονόματα των κλειδιών ενός αντικειμένου (`nestedKeyCatalog`) και τις λέξεις των τιμών του ανά κλειδί
 * (`itemCatalogs`). Χωρίς δήλωση ⇒ η τιμή φαίνεται ωμή, **ορατά** — ποτέ σιωπηλή μαντεψιά.
 */
export interface AuditFieldVocabulary {
  readonly enumCatalog?: AuditCatalogRef;
  readonly nestedKeyCatalog?: AuditCatalogRef;
  readonly itemCatalogs?: Readonly<Record<string, AuditCatalogRef>>;
}

/**
 * `trackedFieldDefsIn('catalog:audit.fields')(['type'], ['labels'], { type: { enumCatalog } })` ⇒ πεδία με ετικέτα
 * `catalog:audit.fields.type` κ.λπ. Τα `scalars` συγκρίνονται ως έχουν, τα `complexes` ως κανονικοποιημένο JSON· το
 * `vocabulary` (προαιρετικό) δηλώνει τις λέξεις των τιμών τους.
 */
export function trackedFieldDefsIn(labelPrefix: string) {
  const scalar = (field: string, vocabulary: AuditFieldVocabulary = {}): TrackedFieldDef =>
    ({ kind: 'scalar', label: field, labelKey: `${labelPrefix}.${field}`, ...vocabulary });
  const complex = (field: string, vocabulary: AuditFieldVocabulary = {}): TrackedFieldDef =>
    ({ kind: 'scalar', label: field, labelKey: `${labelPrefix}.${field}`, ...vocabulary, value: structuredAuditValue });
  return (
    scalars: readonly string[],
    complexes: readonly string[],
    vocabulary: Readonly<Record<string, AuditFieldVocabulary>> = {},
  ): Record<string, TrackedFieldDef> =>
    Object.fromEntries([
      ...scalars.map((field) => [field, scalar(field, vocabulary[field])] as const),
      ...complexes.map((field) => [field, complex(field, vocabulary[field])] as const),
    ]);
}
