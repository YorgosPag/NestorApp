/**
 * SSoT entity display formatters.
 * @module lib/entity-formatters
 */

/**
 * Format a building label for display (dropdowns, cards, headers, breadcrumbs).
 *
 * ADR-233 §3.4: `code` is the locked system identifier (e.g. "Κτήριο Α").
 * When both `code` and `name` exist and differ, shows "code — name".
 * Falls back to whichever is available, or `fallback`.
 *
 * @example
 * formatBuildingLabel('Κτήριο Α', 'Πολυκατοικία Παλαιολόγου') // "Κτήριο Α — Πολυκατοικία Παλαιολόγου"
 * formatBuildingLabel('Κτήριο Α', 'Κτήριο Α')                 // "Κτήριο Α"
 * formatBuildingLabel(undefined, 'Πολυκατοικία')               // "Πολυκατοικία"
 * formatBuildingLabel('Κτήριο Α')                              // "Κτήριο Α"
 */
export function formatBuildingLabel(
  code?: string | null,
  name?: string | null,
  fallback?: string,
): string {
  // Τα πεδία έρχονται από φόρμες: «  ΝΕΟ» με κενό μπροστά έδινε «Κτίριο Α —  ΝΕΟ» — αόρατο στο HTML (σύμπτυξη κενών),
  // ορατό σε όνομα αρχείου και κελί Excel (ADR-898 Φ4β).
  const c = code?.trim();
  const n = name?.trim();
  if (c && n && n !== c) return `${c} — ${n}`;
  return c || n || fallback || '';
}
