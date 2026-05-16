/**
 * Layer picker persistence — ADR-358 §5.5.bis Q8 Phase 7.
 *
 * Pure localStorage helpers (no React, no Firestore). Cross-device sync
 * sits on top via `useCurrentLayerPickerPersistence` (Firestore through
 * `userSettingsRepository` slice `dxfViewer.dxfSettings.layerPicker`).
 *
 * Storage layout (keyed by project + level for currentLayerId — per-user
 * is implicit since userId scopes the userSettings doc itself):
 *   `dxf:currentLayer:{projectId}:{levelId}`  → layerId
 *   `dxf:recentLayers:{projectId}`           → JSON string[] (FIFO, max 10)
 *
 * Resilient to SSR + private-mode failures: all access guarded against
 * missing `window.localStorage` and try/catch on parse.
 */

import { RECENT_LAYERS_MAX } from '../../../stores/LayerStore';

const CURRENT_KEY_PREFIX = 'dxf:currentLayer';
const RECENT_KEY_PREFIX = 'dxf:recentLayers';

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function currentLayerStorageKey(projectId: string, levelId: string): string {
  return `${CURRENT_KEY_PREFIX}:${projectId}:${levelId}`;
}

export function recentLayersStorageKey(projectId: string): string {
  return `${RECENT_KEY_PREFIX}:${projectId}`;
}

export function readCurrentLayerLocal(
  projectId: string,
  levelId: string,
): string | null {
  const storage = safeStorage();
  if (!storage || !projectId || !levelId) return null;
  return storage.getItem(currentLayerStorageKey(projectId, levelId));
}

export function writeCurrentLayerLocal(
  projectId: string,
  levelId: string,
  layerId: string | null,
): void {
  const storage = safeStorage();
  if (!storage || !projectId || !levelId) return;
  const key = currentLayerStorageKey(projectId, levelId);
  if (layerId === null) {
    storage.removeItem(key);
    return;
  }
  storage.setItem(key, layerId);
}

export function readRecentLayersLocal(projectId: string): ReadonlyArray<string> {
  const storage = safeStorage();
  if (!storage || !projectId) return [];
  const raw = storage.getItem(recentLayersStorageKey(projectId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string').slice(0, RECENT_LAYERS_MAX);
  } catch {
    return [];
  }
}

export function writeRecentLayersLocal(
  projectId: string,
  ids: ReadonlyArray<string>,
): void {
  const storage = safeStorage();
  if (!storage || !projectId) return;
  const trimmed = ids.slice(0, RECENT_LAYERS_MAX);
  storage.setItem(recentLayersStorageKey(projectId), JSON.stringify(trimmed));
}

/**
 * Firestore-side shape under `dxfViewer.dxfSettings.layerPicker` slice.
 * Bag of small per-project maps — cheap to round-trip via the
 * `userSettingsRepository` debounce. Cross-device, last-write-wins.
 */
export interface LayerPickerFirestoreSlice {
  currentByLevel?: Record<string, Record<string, string>>;
  recentByProject?: Record<string, string[]>;
}

export function mergeCurrentLayerIntoSlice(
  slice: LayerPickerFirestoreSlice,
  projectId: string,
  levelId: string,
  layerId: string | null,
): LayerPickerFirestoreSlice {
  const next = { ...slice };
  const map = { ...(slice.currentByLevel ?? {}) };
  const levelMap = { ...(map[projectId] ?? {}) };
  if (layerId === null) delete levelMap[levelId];
  else levelMap[levelId] = layerId;
  if (Object.keys(levelMap).length === 0) delete map[projectId];
  else map[projectId] = levelMap;
  next.currentByLevel = map;
  return next;
}

export function mergeRecentIntoSlice(
  slice: LayerPickerFirestoreSlice,
  projectId: string,
  ids: ReadonlyArray<string>,
): LayerPickerFirestoreSlice {
  const next = { ...slice };
  const map = { ...(slice.recentByProject ?? {}) };
  if (ids.length === 0) delete map[projectId];
  else map[projectId] = ids.slice(0, RECENT_LAYERS_MAX);
  next.recentByProject = map;
  return next;
}

export function pickCurrentFromSlice(
  slice: LayerPickerFirestoreSlice | undefined,
  projectId: string,
  levelId: string,
): string | null {
  return slice?.currentByLevel?.[projectId]?.[levelId] ?? null;
}

export function pickRecentFromSlice(
  slice: LayerPickerFirestoreSlice | undefined,
  projectId: string,
): ReadonlyArray<string> {
  return slice?.recentByProject?.[projectId] ?? [];
}
