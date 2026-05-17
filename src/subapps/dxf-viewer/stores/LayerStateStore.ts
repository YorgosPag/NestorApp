/**
 * LayerStateStore — micro-leaf SSoT for saved Layer States runtime state
 * (ADR-358 §5.9 Q12, Phase 12).
 *
 * Sibling of `LayerStore` + `LayerFiltersStore`. Holds: user-saved states
 * (persisted), current applied state id (session-only, no persistence),
 * hydration status. Captures the current LayerStore snapshot on `saveCurrent`
 * via the `createLayerStateEntry` factory; restore is delegated to
 * `RestoreLayerStateCommand` so undo lives in the global CommandHistory.
 *
 * Lifecycle:
 *   - `setProjectId(projectId, userId)` → attach persistence listener, hydrate.
 *   - `clearProject()` → detach, reset.
 *   - Subscribers via `subscribeLayerStateStore` + `getLayerStateStoreSnapshot`
 *     (useSyncExternalStore-compatible).
 *
 * Pattern reference: `LayerFiltersStore.ts`. Pre-commit ratchet
 * `layer-state-system` blocks direct persistence writes outside this store +
 * the persistence service.
 */

import { nowISO } from '@/lib/date-local';
import { getAllLayers } from './LayerStore';
import {
  createLayerState,
  createLayerStateEntry,
  type LayerState,
  type LayerStateEntry,
} from '../types/layer-state';
import {
  deleteLayerState as persistDelete,
  saveLayerState as persistSave,
  subscribeProjectLayerStates,
  type LayerStatePersistenceHandle,
} from '../services/layer-state-persistence';
import { parseLasContent } from '../services/las-parser';
import { serializeLasContent } from '../services/las-exporter';

type Listener = () => void;

export type LayerStateHydrationStatus = 'idle' | 'hydrating' | 'ready';

export interface LayerStateStoreSnapshot {
  readonly projectId: string | null;
  readonly states: ReadonlyArray<LayerState>;
  /** Id of the most-recently applied state in this session. Null on load + on edits. */
  readonly currentStateId: string | null;
  readonly hydrationStatus: LayerStateHydrationStatus;
}

const EMPTY_SNAPSHOT: LayerStateStoreSnapshot = Object.freeze({
  projectId: null,
  states: Object.freeze([]) as ReadonlyArray<LayerState>,
  currentStateId: null,
  hydrationStatus: 'idle',
});

// ─── State (singleton) ───────────────────────────────────────────────────────

let projectId: string | null = null;
let currentUserId: string = 'anonymous';
let states: ReadonlyArray<LayerState> = [];
let currentStateId: string | null = null;
let hydrationStatus: LayerStateHydrationStatus = 'idle';
let cached: LayerStateStoreSnapshot = EMPTY_SNAPSHOT;
let persistenceHandle: LayerStatePersistenceHandle | null = null;

const subscribers = new Set<Listener>();

// ─── Snapshot getter (useSyncExternalStore-compatible) ───────────────────────

export function getLayerStateStoreSnapshot(): LayerStateStoreSnapshot {
  return cached;
}

export function subscribeLayerStateStore(cb: Listener): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

/**
 * Attach to a project. Idempotent — calling with the same projectId is a
 * no-op. Calling with a new projectId detaches the previous listener first.
 *
 * `userId` is recorded into `createdByUserId` on subsequent `saveCurrent`
 * calls; pass `'anonymous'` for unauthenticated dev contexts.
 */
export function setProjectId(nextProjectId: string | null, userId: string = 'anonymous'): void {
  if (nextProjectId === projectId) {
    currentUserId = userId;
    return;
  }
  detachPersistence();
  projectId = nextProjectId;
  currentUserId = userId;
  currentStateId = null;
  if (nextProjectId === null) {
    states = [];
    hydrationStatus = 'idle';
    rebuildAndNotify();
    return;
  }
  hydrationStatus = 'hydrating';
  rebuildAndNotify();
  persistenceHandle = subscribeProjectLayerStates(nextProjectId, (loaded) => {
    states = loaded;
    hydrationStatus = 'ready';
    rebuildAndNotify();
  });
}

export function clearProject(): void {
  setProjectId(null);
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export function listLayerStates(): ReadonlyArray<LayerState> {
  return cached.states;
}

export function getLayerState(id: string): LayerState | null {
  return cached.states.find((s) => s.id === id) ?? null;
}

export function getCurrentStateId(): string | null {
  return currentStateId;
}

// ─── Mutations (persisted) ───────────────────────────────────────────────────

/**
 * Capture the current LayerStore state as a new saved `LayerState`. Returns
 * the new state. No-op if no project is attached (returns null).
 */
export function saveCurrentLayerState(input: {
  name: string;
  description?: string;
  icon?: string;
}): LayerState | null {
  if (!projectId) return null;
  const snapshot = captureCurrentSnapshot();
  const state = createLayerState({
    name: input.name,
    description: input.description,
    icon: input.icon,
    snapshot,
    createdByUserId: currentUserId,
  });
  persistSave(projectId, state);
  return state;
}

/**
 * Rename a saved state in-place. Bumps `updatedAt`. No-op if not found or no
 * project attached.
 */
export function renameLayerState(id: string, newName: string): LayerState | null {
  if (!projectId) return null;
  const current = cached.states.find((s) => s.id === id);
  if (!current) return null;
  const next: LayerState = {
    ...current,
    name: newName,
    updatedAt: nowISO(),
  };
  persistSave(projectId, next);
  return next;
}

export function deleteLayerStateById(id: string): void {
  if (!projectId) return;
  persistDelete(projectId, id);
  if (currentStateId === id) {
    currentStateId = null;
    rebuildAndNotify();
  }
}

/**
 * Mark a state as the current applied one. Called by `RestoreLayerStateCommand`
 * after a successful apply; the store does NOT mutate `LayerStore` itself.
 * Pass `null` to clear the indicator (any edit invalidates the "current" badge).
 */
export function markCurrentLayerState(id: string | null): void {
  if (id === currentStateId) return;
  if (id !== null && !cached.states.some((s) => s.id === id)) return;
  currentStateId = id;
  rebuildAndNotify();
}

// ─── .las I/O (Phase 13A — ADR-358 §5.9 Q12) ─────────────────────────────────

export interface LasImportSummary {
  readonly added: number;
  readonly skipped: number;
  readonly errors: ReadonlyArray<string>;
}

/**
 * Serialize the saved states (or a subset by id) to `.las` ASCII text. Returns
 * empty string when no states match. Pure read — no persistence side effects.
 */
export function exportLayerStatesAsLas(ids?: ReadonlyArray<string>): string {
  const all = cached.states;
  const target = ids && ids.length > 0
    ? all.filter((s) => ids.includes(s.id))
    : all;
  if (target.length === 0) return '';
  return serializeLasContent(target);
}

/**
 * Parse `.las` ASCII content and persist each valid state as a new saved
 * `LayerState` (source `'las-import'`). Duplicates by name are skipped — the
 * user must rename or delete first. Returns an import summary for the UI toast.
 */
export function importLayerStatesFromLas(content: string): LasImportSummary {
  if (!projectId) return { added: 0, skipped: 0, errors: ['No project attached'] };
  const result = parseLasContent(content, currentUserId);
  const existingNames = new Set(cached.states.map((s) => s.name.toLowerCase()));
  let added = 0;
  let skipped = 0;
  const errors = result.errors.map((e) =>
    e.stateName ? `${e.stateName} (line ${e.line}): ${e.message}` : `Line ${e.line}: ${e.message}`,
  );
  for (const state of result.states) {
    if (existingNames.has(state.name.toLowerCase())) {
      skipped++;
      continue;
    }
    persistSave(projectId, state);
    existingNames.add(state.name.toLowerCase());
    added++;
  }
  return { added, skipped, errors };
}

// ─── Capture helper (pure) ───────────────────────────────────────────────────

/**
 * Build a `LayerStateEntry[]` snapshot from the live `LayerStore`. Exported
 * for tests + the eventual `.las` exporter (Phase 13).
 */
export function captureCurrentSnapshot(): ReadonlyArray<LayerStateEntry> {
  return getAllLayers().map((layer) =>
    createLayerStateEntry({
      layerId: layer.id,
      layerName: layer.name,
      visible: layer.visible,
      frozen: layer.frozen,
      locked: layer.locked,
      color: layer.color,
      colorAci: layer.colorAci,
      colorTrueColor: layer.colorTrueColor,
      linetype: layer.linetype,
      lineweight: layer.lineweight,
      transparency: layer.transparency,
      plottable: layer.plottable,
    }),
  );
}

// ─── Internals ───────────────────────────────────────────────────────────────

function detachPersistence(): void {
  if (persistenceHandle) {
    persistenceHandle.unsubscribe();
    persistenceHandle = null;
  }
}

function rebuildAndNotify(): void {
  cached = Object.freeze({
    projectId,
    states,
    currentStateId,
    hydrationStatus,
  });
  subscribers.forEach((cb) => cb());
}

// ─── Test-only reset ─────────────────────────────────────────────────────────

/** @internal Reset to empty state. Tests only. */
export function __resetLayerStateStoreForTesting(): void {
  detachPersistence();
  projectId = null;
  currentUserId = 'anonymous';
  states = [];
  currentStateId = null;
  hydrationStatus = 'idle';
  cached = EMPTY_SNAPSHOT;
  subscribers.clear();
}
