/**
 * layer-filter-persistence.ts — Project-scoped persistence for user `LayerFilter`s
 * (ADR-358 §5.7.bis Q11, Phase 11).
 *
 * Thin adapter πάνω στο SSoT `createProjectScopedStore` (κοινό με τα layer states).
 * Το public surface — `subscribeProjectFilters`, `saveFilter`, `deleteFilter`,
 * `replaceProjectFilters` — παραμένει ίδιο (matches το eventual Firestore pattern
 * `projects/{projectId}/layerFilters/{filterId}`, zero change στους consumers).
 * See ADR-358 §10 v2.15-pre0 changelog για το Firestore deferral rationale.
 *
 * Storage layout:
 *   `dxf:layerFilters:{projectId}` → JSON `LayerFilter[]` (user-created + imported only).
 *
 * Defensive validation μέσω `validateLayerFilterJsonBulk` (μέσω `sanitize`).
 * Pre-commit ratchet `layer-filter-engine` includes this file in the allowlist.
 */

import type { LayerFilter } from '../types/layer-filters';
import { validateLayerFilterJsonBulk } from './layer-filter-validation';
import { createProjectScopedStore, type ProjectScopedHandle } from './project-scoped-persistence';

export type FilterPersistenceListener = (filters: ReadonlyArray<LayerFilter>) => void;
export type FilterPersistenceHandle = ProjectScopedHandle;

const store = createProjectScopedStore<LayerFilter>({
  storagePrefix: 'dxf:layerFilters',
  idOf: (filter) => filter.id,
  sanitize: (parsed) => validateLayerFilterJsonBulk(parsed).valid,
  // JSON import must never persist system-smart filters.
  onReplace: (filters) => filters.filter((f) => f.source !== 'system-smart'),
});

/** Read + validate persisted filters for a project (malformed entries dropped). */
export function readProjectFilters(projectId: string): ReadonlyArray<LayerFilter> {
  return store.readProject(projectId);
}

/**
 * Subscribe to project filter changes. Fires immediately with the current
 * persisted snapshot, then on every save/delete/replace for the same `projectId`.
 * Returns a handle whose `unsubscribe()` is idempotent.
 */
export function subscribeProjectFilters(
  projectId: string,
  listener: FilterPersistenceListener,
): FilterPersistenceHandle {
  return store.subscribe(projectId, listener);
}

/** Upsert a single filter. Replaces by id; appends if new. */
export function saveFilter(projectId: string, filter: LayerFilter): void {
  store.save(projectId, filter);
}

/** Remove a filter by id. No-op if missing. */
export function deleteFilter(projectId: string, filterId: string): void {
  store.remove(projectId, filterId);
}

/** Replace the entire filter list (used by JSON import). */
export function replaceProjectFilters(
  projectId: string,
  filters: ReadonlyArray<LayerFilter>,
): void {
  store.replace(projectId, filters);
}

/** @internal Clear all listeners. Tests only. */
export function __resetFilterPersistenceForTesting(): void {
  store.reset();
}
