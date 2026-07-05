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
import type {
  DxfLayerStateTemplateService,
  SearchTemplatesQuery,
} from '@/services/dxf-layer-state-template.service';
import type {
  LayerStateTemplate,
  LayerStateTemplateSummary,
} from '../types/layer-state-template';
import { createExternalStore } from './createExternalStore';

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
let persistenceHandle: LayerStatePersistenceHandle | null = null;
let templateService: DxfLayerStateTemplateService | null = null;

// SSoT pub/sub via createExternalStore (WAVE 2.6). The lets above stay as
// mutation accelerators; `cached`/`subscribers` collapse into this single
// composite-snapshot store — `rebuildAndNotify()` still builds the derived
// object, but commits it via `store.set(...)` (always-notify, no `equals`).
const store = createExternalStore<LayerStateStoreSnapshot>(EMPTY_SNAPSHOT);

// ─── Snapshot getter (useSyncExternalStore-compatible) ───────────────────────

export function getLayerStateStoreSnapshot(): LayerStateStoreSnapshot {
  return store.get();
}

export function subscribeLayerStateStore(cb: Listener): () => void {
  return store.subscribe(cb);
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
  return store.get().states;
}

export function getLayerState(id: string): LayerState | null {
  return store.get().states.find((s) => s.id === id) ?? null;
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
  const current = store.get().states.find((s) => s.id === id);
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

/** Duplicate a saved state with a new name. `nameSuffix` is passed by the UI (localized). */
export function duplicateLayerState(id: string, nameSuffix: string): LayerState | null {
  if (!projectId) return null;
  const source = store.get().states.find((s) => s.id === id);
  if (!source) return null;
  const copy = createLayerState({
    name: `${source.name} ${nameSuffix}`,
    snapshot: source.snapshot,
    createdByUserId: currentUserId,
    description: source.description,
    category: source.category,
    tags: source.tags,
  });
  persistSave(projectId, copy);
  return copy;
}

/** Update the category of a saved state. Bumps `updatedAt`. */
export function updateLayerStateCategory(id: string, category: string): LayerState | null {
  if (!projectId) return null;
  const current = store.get().states.find((s) => s.id === id);
  if (!current) return null;
  const next: LayerState = { ...current, category: category.trim() || undefined, updatedAt: nowISO() };
  persistSave(projectId, next);
  return next;
}

/**
 * Mark a state as the current applied one. Called by `RestoreLayerStateCommand`
 * after a successful apply; the store does NOT mutate `LayerStore` itself.
 * Pass `null` to clear the indicator (any edit invalidates the "current" badge).
 */
export function markCurrentLayerState(id: string | null): void {
  if (id === currentStateId) return;
  if (id !== null && !store.get().states.some((s) => s.id === id)) return;
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
  const all = store.get().states;
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
  const existingNames = new Set(store.get().states.map((s) => s.name.toLowerCase()));
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

// ─── Cross-project templates (Phase 13B.2 — ADR-358 §5.9 Q12) ────────────────

/**
 * Inject (or clear) the Firestore-backed template service. The orchestrator
 * hook `useLayerStateTemplates` owns the lifecycle: it constructs a service
 * once `companyId` + `userId` are available and clears it on unmount. The
 * store itself does NOT instantiate Firebase — keeps the SSoT mockable.
 *
 * Pre-commit ratchet `layer-state-system` blocks setter calls outside the
 * orchestrator hook + tests.
 */
export function setLayerStateTemplateService(
  svc: DxfLayerStateTemplateService | null,
): void {
  templateService = svc;
}

/**
 * Snapshot the live LayerStore and persist it as a company-scoped template.
 * Throws if no service is injected (caller must mount the orchestrator hook
 * first). Snapshot capture is delegated to `captureCurrentSnapshot()` so
 * template and saved-state share the exact same per-layer shape.
 */
export async function saveCurrentAsTemplate(input: {
  name: string;
  description?: string;
  category?: string;
  tags?: ReadonlyArray<string>;
  sourceStateId?: string;
}): Promise<LayerStateTemplate> {
  const svc = requireTemplateService('saveCurrentAsTemplate');
  const snapshot = captureCurrentSnapshot();
  return svc.saveAsTemplate({
    name: input.name,
    description: input.description,
    category: input.category,
    tags: input.tags,
    snapshot,
    sourceStateId: input.sourceStateId,
  });
}

/**
 * Fetch a company template and clone it as a project-local `LayerState`
 * (source `'template-shared'`, retains `sourceTemplateId` for audit). Returns
 * null when no project is attached (the store has no place to persist it).
 */
export async function importTemplateAsState(
  templateId: string,
): Promise<LayerState | null> {
  if (!projectId) return null;
  const svc = requireTemplateService('importTemplateAsState');
  const template = await svc.getTemplate(templateId);
  const state = createLayerState({
    name: template.name,
    description: template.description,
    snapshot: template.snapshot,
    createdByUserId: currentUserId,
    source: 'template-shared',
    sourceTemplateId: template.id,
  });
  persistSave(projectId, state);
  return state;
}

/**
 * Forward a search to the injected service. Pure passthrough — keeps the
 * orchestrator hook + UI layer decoupled from the service shape.
 */
export async function searchTemplateSummaries(
  q?: SearchTemplatesQuery,
): Promise<readonly LayerStateTemplateSummary[]> {
  const svc = requireTemplateService('searchTemplateSummaries');
  return svc.listTemplateSummaries(q);
}

function requireTemplateService(caller: string): DxfLayerStateTemplateService {
  if (!templateService) {
    throw new Error(
      `LayerStateStore.${caller}: no template service injected — mount useLayerStateTemplates first`,
    );
  }
  return templateService;
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
  store.set(Object.freeze({
    projectId,
    states,
    currentStateId,
    hydrationStatus,
  }));
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
  templateService = null;
  store.reset(EMPTY_SNAPSHOT);
}

/** @internal Read the injected template service ref. Tests only. */
export function __getLayerStateTemplateServiceForTesting(): DxfLayerStateTemplateService | null {
  return templateService;
}
