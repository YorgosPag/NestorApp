/**
 * Persists the last active BIM properties sub-tab per entity type in localStorage.
 * ADR-366 C.4.Q6: per-user persistence, localStorage primary + Firestore sync on settings save.
 * Consumed by `BimPropertiesShell` (the 3D card was merged into the floating palette).
 */

// 🏢 ADR-092 — persistence via the storage-utils SSoT (SSR-safe + quota-guarded + JSON),
// not hand-rolled getItem/JSON.parse/setItem. Non-reactive read-modify-write per call.
import { storageGet, storageSet } from '../../../utils/storage-utils';

const STORAGE_KEY = 'bim3d:entityCardTabs';

export function getLastActiveTab(entityType: string): string {
  const map = storageGet<Record<string, string>>(STORAGE_KEY, {});
  return map[entityType] ?? 'parameters';
}

export function setLastActiveTab(entityType: string, tabValue: string): void {
  const map = storageGet<Record<string, string>>(STORAGE_KEY, {});
  map[entityType] = tabValue;
  storageSet(STORAGE_KEY, map);
}
