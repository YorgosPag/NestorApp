/**
 * Persists the last active BIM properties sub-tab per entity type in localStorage.
 * ADR-366 C.4.Q6: per-user persistence, localStorage primary + Firestore sync on settings save.
 * Consumed by `BimPropertiesShell` (the 3D card was merged into the floating palette).
 */

const STORAGE_KEY = 'bim3d:entityCardTabs';

export function getLastActiveTab(entityType: string): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'parameters';
    const map = JSON.parse(raw) as Record<string, string>;
    return map[entityType] ?? 'parameters';
  } catch {
    return 'parameters';
  }
}

export function setLastActiveTab(entityType: string, tabValue: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[entityType] = tabValue;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable (SSR or private mode)
  }
}
