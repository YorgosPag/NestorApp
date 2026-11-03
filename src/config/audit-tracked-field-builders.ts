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
import { canonicalJson } from '@/lib/legal/canonical-json';

/** Προβολή σύνθετης τιμής σε σταθερό κείμενο ιστορικού. */
export function structuredAuditValue(value: unknown): string | null {
  return value === null || value === undefined ? null : canonicalJson(value).trim();
}

/**
 * `trackedFieldDefsIn('catalog:audit.fields')(['type'], ['labels'])` ⇒ πεδία με ετικέτα `catalog:audit.fields.type` κ.λπ.
 * Τα `scalars` συγκρίνονται ως έχουν, τα `complexes` ως κανονικοποιημένο JSON.
 */
export function trackedFieldDefsIn(labelPrefix: string) {
  const scalar = (field: string): TrackedFieldDef => ({ kind: 'scalar', label: field, labelKey: `${labelPrefix}.${field}` });
  const complex = (field: string): TrackedFieldDef => ({ ...scalar(field), value: structuredAuditValue });
  return (scalars: readonly string[], complexes: readonly string[]): Record<string, TrackedFieldDef> =>
    Object.fromEntries([
      ...scalars.map((field) => [field, scalar(field)] as const),
      ...complexes.map((field) => [field, complex(field)] as const),
    ]);
}
