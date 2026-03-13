/**
 * 🏢 ENTERPRISE: Centralized toggle-select utility
 *
 * Clicking the already-selected item deselects it (returns null).
 * Clicking a different item selects it.
 *
 * Used by all entity pages: Contacts, Projects, Buildings, Parking, Storage.
 * Units handle toggle internally via handlePolygonSelect.
 */
export function toggleSelect<T extends { id?: string }>(
  current: T | null,
  next: T | null
): T | null {
  if (!next) return null;
  return current?.id === next.id ? null : next;
}
