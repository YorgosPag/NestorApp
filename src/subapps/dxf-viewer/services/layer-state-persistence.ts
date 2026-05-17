/**
 * layer-state-persistence.ts — Project-scoped persistence for user `LayerState`s
 * (ADR-358 §5.9 Q12, Phase 12).
 *
 * Phase 12 lands with localStorage SSoT (per-user, per-project). The public
 * surface — `subscribeProjectLayerStates`, `saveLayerState`, `deleteLayerState`,
 * `replaceProjectLayerStates` — matches the eventual Firestore subcollection
 * pattern `projects/{projectId}/layerStates/{stateId}` so a future swap to
 * onSnapshot/setDoc/deleteDoc requires zero change in `LayerStateStore` or
 * any UI consumer. See ADR-358 §10 v2.16-pre0 changelog for rationale (same
 * playbook as Phase 11 `layer-filter-persistence.ts`).
 *
 * Storage layout:
 *   `dxf:layerStates:{projectId}` → JSON `LayerState[]`.
 *
 * Resilient to SSR + private-mode failures: every access guarded against
 * missing `window.localStorage` and try/catch on parse. Malformed legacy
 * entries are dropped silently so the UI never crashes on hand-edited storage.
 *
 * Pre-commit ratchet `layer-state-system` includes this file in the allowlist.
 */

import type { LayerState } from '../types/layer-state';

const STORAGE_PREFIX = 'dxf:layerStates';

export type LayerStatePersistenceListener = (states: ReadonlyArray<LayerState>) => void;

export interface LayerStatePersistenceHandle {
  /** Detach the listener. Idempotent. */
  readonly unsubscribe: () => void;
}

const listeners = new Map<string, Set<LayerStatePersistenceListener>>();

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}:${projectId}`;
}

function isValidEntry(value: unknown): value is LayerState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.snapshot) &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string'
  );
}

/**
 * Read + validate persisted layer states for a project. Filters out malformed
 * entries (defensive — local storage may have been hand-edited or written by
 * a prior schema version).
 */
export function readProjectLayerStates(projectId: string): ReadonlyArray<LayerState> {
  const storage = safeStorage();
  if (!storage || !projectId) return [];
  const raw = storage.getItem(storageKey(projectId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry);
  } catch {
    return [];
  }
}

/**
 * Subscribe to layer state changes. Fires immediately with the current
 * persisted snapshot, then on every save/delete/replace for the same
 * `projectId`. Returns a handle whose `unsubscribe()` is idempotent.
 */
export function subscribeProjectLayerStates(
  projectId: string,
  listener: LayerStatePersistenceListener,
): LayerStatePersistenceHandle {
  let bucket = listeners.get(projectId);
  if (!bucket) {
    bucket = new Set();
    listeners.set(projectId, bucket);
  }
  bucket.add(listener);
  listener(readProjectLayerStates(projectId));
  return {
    unsubscribe: () => {
      const current = listeners.get(projectId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) listeners.delete(projectId);
    },
  };
}

/** Upsert a single layer state. Replaces by id; appends if new. */
export function saveLayerState(projectId: string, state: LayerState): void {
  const storage = safeStorage();
  if (!storage || !projectId) return;
  const current = readProjectLayerStates(projectId);
  const next = upsert(current, state);
  storage.setItem(storageKey(projectId), JSON.stringify(next));
  emit(projectId, next);
}

/** Remove a layer state by id. No-op if missing. */
export function deleteLayerState(projectId: string, stateId: string): void {
  const storage = safeStorage();
  if (!storage || !projectId) return;
  const current = readProjectLayerStates(projectId);
  const next = current.filter((s) => s.id !== stateId);
  if (next.length === current.length) return;
  storage.setItem(storageKey(projectId), JSON.stringify(next));
  emit(projectId, next);
}

/** Replace the entire state list (used by hydration after schema migration / `.las` Phase 13). */
export function replaceProjectLayerStates(
  projectId: string,
  states: ReadonlyArray<LayerState>,
): void {
  const storage = safeStorage();
  if (!storage || !projectId) return;
  storage.setItem(storageKey(projectId), JSON.stringify(states));
  emit(projectId, states);
}

function upsert(
  current: ReadonlyArray<LayerState>,
  state: LayerState,
): ReadonlyArray<LayerState> {
  const idx = current.findIndex((s) => s.id === state.id);
  if (idx === -1) return [...current, state];
  const next = current.slice();
  next[idx] = state;
  return next;
}

function emit(projectId: string, snapshot: ReadonlyArray<LayerState>): void {
  const bucket = listeners.get(projectId);
  if (!bucket) return;
  bucket.forEach((listener) => listener(snapshot));
}

/** @internal Clear all listeners. Tests only. */
export function __resetLayerStatePersistenceForTesting(): void {
  listeners.clear();
}
