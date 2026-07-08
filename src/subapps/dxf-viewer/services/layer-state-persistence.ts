/**
 * layer-state-persistence.ts — Project-scoped persistence for user `LayerState`s
 * (ADR-358 §5.9 Q12, Phase 12).
 *
 * Thin adapter πάνω στο SSoT `createProjectScopedStore` (κοινό με τα layer filters
 * Phase 11). Το public surface — `subscribeProjectLayerStates`, `saveLayerState`,
 * `deleteLayerState`, `replaceProjectLayerStates` — παραμένει ίδιο (matches το
 * eventual Firestore pattern `projects/{projectId}/layerStates/{stateId}`, zero
 * change στους consumers). See ADR-358 §10 v2.16-pre0 changelog για το rationale.
 *
 * Storage layout:
 *   `dxf:layerStates:{projectId}` → JSON `LayerState[]`.
 *
 * Malformed legacy entries dropped silently μέσω `isValidEntry` (μέσω `sanitize`).
 * Pre-commit ratchet `layer-state-system` includes this file in the allowlist.
 */

import type { LayerState } from '../types/layer-state';
import { createProjectScopedStore, type ProjectScopedHandle } from './project-scoped-persistence';

export type LayerStatePersistenceListener = (states: ReadonlyArray<LayerState>) => void;
export type LayerStatePersistenceHandle = ProjectScopedHandle;

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

const store = createProjectScopedStore<LayerState>({
  storagePrefix: 'dxf:layerStates',
  idOf: (state) => state.id,
  sanitize: (parsed) => parsed.filter(isValidEntry),
});

/** Read + validate persisted layer states for a project (malformed entries dropped). */
export function readProjectLayerStates(projectId: string): ReadonlyArray<LayerState> {
  return store.readProject(projectId);
}

/**
 * Subscribe to layer state changes. Fires immediately with the current persisted
 * snapshot, then on every save/delete/replace for the same `projectId`. Returns a
 * handle whose `unsubscribe()` is idempotent.
 */
export function subscribeProjectLayerStates(
  projectId: string,
  listener: LayerStatePersistenceListener,
): LayerStatePersistenceHandle {
  return store.subscribe(projectId, listener);
}

/** Upsert a single layer state. Replaces by id; appends if new. */
export function saveLayerState(projectId: string, state: LayerState): void {
  store.save(projectId, state);
}

/** Remove a layer state by id. No-op if missing. */
export function deleteLayerState(projectId: string, stateId: string): void {
  store.remove(projectId, stateId);
}

/** Replace the entire state list (used by hydration after schema migration / `.las` Phase 13). */
export function replaceProjectLayerStates(
  projectId: string,
  states: ReadonlyArray<LayerState>,
): void {
  store.replace(projectId, states);
}

/** @internal Clear all listeners. Tests only. */
export function __resetLayerStatePersistenceForTesting(): void {
  store.reset();
}
