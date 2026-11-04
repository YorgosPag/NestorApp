/**
 * @fileoverview **Αποθηκευμένο αναγνωριστικό → κλειδί καταλόγου i18n** (ADR-279).
 * @module lib/string/catalog-key
 *
 * Οι τιμές αποθηκεύονται ως `snake_case` / `kebab-case` (`fire_department`, `closed_won`), ενώ οι κατάλογοι i18n
 * έχουν μόνο κλειδιά `camelCase` (`fireDepartment`, `closedWon`) — το CHECK 3.14 το επιβάλλει. Μονόδρομη και ασφαλής
 * μετατροπή· ΕΝΑ σημείο, ώστε resolver ιστορικού και κατάλογοι τομέα να μην αποκλίνουν.
 */

export function toCatalogKey(value: string): string {
  return value.replace(/[_-]([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}
