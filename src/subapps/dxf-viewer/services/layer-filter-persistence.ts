/**
 * layer-filter-persistence.ts — Project-scoped persistence for user `LayerFilter`s
 * (ADR-358 §5.7.bis Q11, Phase 11).
 *
 * Phase 11 lands with localStorage SSoT (per-user, per-project). The public
 * surface — `subscribeProjectFilters`, `saveFilter`, `deleteFilter` — matches
 * the eventual Firestore subcollection pattern `projects/{projectId}/layerFilters/{filterId}`
 * so a future swap to onSnapshot/setDoc/deleteDoc requires zero change in
 * `LayerFiltersStore` or any UI consumer. See ADR-358 §10 v2.15-pre0 changelog
 * for the Firestore deferral rationale.
 *
 * Storage layout:
 *   `dxf:layerFilters:{projectId}` → JSON `LayerFilter[]` (user-created + imported only).
 *
 * Resilient to SSR + private-mode failures: all access guarded against missing
 * `window.localStorage` and try/catch on parse. Defensive validation through
 * `validateLayerFilterJsonBulk` keeps malformed legacy entries from crashing
 * the UI.
 *
 * Pre-commit ratchet `layer-filter-engine` includes this file in the allowlist.
 */

import type { LayerFilter } from '../types/layer-filters';
import { validateLayerFilterJsonBulk } from './layer-filter-validation';

const STORAGE_PREFIX = 'dxf:layerFilters';

export type FilterPersistenceListener = (filters: ReadonlyArray<LayerFilter>) => void;

export interface FilterPersistenceHandle {
  /** Detach the listener. Idempotent. */
  readonly unsubscribe: () => void;
}

const listeners = new Map<string, Set<FilterPersistenceListener>>();

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

/**
 * Read + validate persisted filters for a project. Filters out malformed
 * entries (defensive — local storage may have been hand-edited or written by
 * a prior schema version).
 */
export function readProjectFilters(projectId: string): ReadonlyArray<LayerFilter> {
  const storage = safeStorage();
  if (!storage || !projectId) return [];
  const raw = storage.getItem(storageKey(projectId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const { valid } = validateLayerFilterJsonBulk(parsed);
    return valid;
  } catch {
    return [];
  }
}

/**
 * Subscribe to project filter changes. Fires immediately with the current
 * persisted snapshot, then on every `saveFilter` / `deleteFilter` /
 * `replaceProjectFilters` for the same `projectId`.
 *
 * Returns a handle whose `unsubscribe()` is idempotent.
 */
export function subscribeProjectFilters(
  projectId: string,
  listener: FilterPersistenceListener,
): FilterPersistenceHandle {
  let bucket = listeners.get(projectId);
  if (!bucket) {
    bucket = new Set();
    listeners.set(projectId, bucket);
  }
  bucket.add(listener);
  // Initial hydration emit (race-free: listener sees current state before next event).
  listener(readProjectFilters(projectId));
  return {
    unsubscribe: () => {
      const current = listeners.get(projectId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) listeners.delete(projectId);
    },
  };
}

/** Upsert a single filter. Replaces by id; appends if new. */
export function saveFilter(projectId: string, filter: LayerFilter): void {
  const storage = safeStorage();
  if (!storage || !projectId) return;
  const current = readProjectFilters(projectId);
  const next = upsert(current, filter);
  storage.setItem(storageKey(projectId), JSON.stringify(next));
  emit(projectId, next);
}

/** Remove a filter by id. No-op if missing. */
export function deleteFilter(projectId: string, filterId: string): void {
  const storage = safeStorage();
  if (!storage || !projectId) return;
  const current = readProjectFilters(projectId);
  const next = current.filter((f) => f.id !== filterId);
  if (next.length === current.length) return;
  storage.setItem(storageKey(projectId), JSON.stringify(next));
  emit(projectId, next);
}

/** Replace the entire filter list (used by JSON import). */
export function replaceProjectFilters(
  projectId: string,
  filters: ReadonlyArray<LayerFilter>,
): void {
  const storage = safeStorage();
  if (!storage || !projectId) return;
  const sanitized = filters.filter((f) => f.source !== 'system-smart');
  storage.setItem(storageKey(projectId), JSON.stringify(sanitized));
  emit(projectId, sanitized);
}

// ─── Internals ───────────────────────────────────────────────────────────────

function upsert(
  current: ReadonlyArray<LayerFilter>,
  filter: LayerFilter,
): ReadonlyArray<LayerFilter> {
  const idx = current.findIndex((f) => f.id === filter.id);
  if (idx === -1) return [...current, filter];
  const next = current.slice();
  next[idx] = filter;
  return next;
}

function emit(projectId: string, snapshot: ReadonlyArray<LayerFilter>): void {
  const bucket = listeners.get(projectId);
  if (!bucket) return;
  bucket.forEach((listener) => listener(snapshot));
}

// ─── Test-only reset ─────────────────────────────────────────────────────────

/** @internal Clear all listeners. Tests only. */
export function __resetFilterPersistenceForTesting(): void {
  listeners.clear();
}
