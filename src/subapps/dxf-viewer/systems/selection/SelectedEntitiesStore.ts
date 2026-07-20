'use client';

/**
 * SELECTED ENTITIES STORE — zero-React mutable singleton SSoT for the entity
 * selection set (the universal selection Map + primary id).
 *
 * ADR-532 / ADR-040 dual-access invariant: orchestrators read imperatively via
 * getters at event time; ONLY leaf components subscribe via the `useSelected*`
 * hooks (useSyncExternalStore) in `useSelectedEntities.ts`. This replaces the
 * React-Context broadcast that re-rendered every consumer on every click
 * (the ~122ms selection commit — see
 * HANDOFF_2026-06-25_selection-cascade-and-always-mounted-dialogs).
 *
 * Pattern mirrors `systems/hover/HoverStore.ts` (module `let` + named exports,
 * skip-if-unchanged) and `systems/cursor/ImmediateTransformStore.ts` (cached
 * derived snapshots + facade). NOT to be confused with
 * `systems/cursor/SelectionStore.ts` (marquee/lasso rubber-band — different).
 *
 * Caching rule (critical): every mutation rebuilds the derived caches ONCE; the
 * getters return the cached reference so `useSyncExternalStore`'s getSnapshot is
 * reference-stable (a fresh array per read would infinite-loop React). Empty
 * results share one frozen EMPTY array.
 *
 * Legacy mirror: each mutator returns a {@link LegacyMirror} describing how the
 * reducer's legacy `selectedRegionIds` / editing state must follow (overlay-only
 * projection). `useSelectionActions` applies it via one dispatch — preserving
 * the exact behavior the old UNIVERSAL_* reducer cases had.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-532-selection-set-ssot.md
 */

import type { SelectableEntityType, SelectionEntry, SelectionPayload } from './types';
import { createSelectionEntry, matchesEntityType } from './types';
import { createExternalStore } from '../../stores/createExternalStore';

type Listener = () => void;

/**
 * Describes how the legacy reducer state (`selectedRegionIds` + region-edit
 * flags) must follow a store mutation. `regionIdsChanged === false` means keep
 * the existing `selectedRegionIds` untouched (dxf-entity-only change).
 */
export interface LegacyMirror {
  readonly regionIdsChanged: boolean;
  readonly regionIds: string[];
  readonly resetEditing: boolean;
}

const NO_MIRROR: LegacyMirror = { regionIdsChanged: false, regionIds: [], resetEditing: false };
const EMPTY_IDS: string[] = Object.freeze([]) as unknown as string[];

// ─── Legacy sink (ADR-532 Stage B — single write path) ─────────────────────────
// The SelectionSystem provider registers a callback that mirrors the overlay/region
// projection (`selectedRegionIds`) + region-edit flags into the React reducer. The
// store invokes it after EVERY mutation (via `applyAndReturn`), so every write path
// — direct store call, `useSelectionActions` wrapper, or orchestrator — applies the
// exact same legacy mirror. This lets orchestrators call mutators imperatively
// (zero React) without the mirror going stale. `null` until the provider mounts
// (and in unit tests, where no React reducer exists).
let legacySink: ((mirror: LegacyMirror) => void) | null = null;

/** Register the legacy mirror sink (provider-owned). Pass `null` to unregister. */
function registerLegacySink(fn: ((mirror: LegacyMirror) => void) | null): void {
  legacySink = fn;
}

/** Notify the legacy sink (if registered), then return the mirror to the caller. */
function applyAndReturn(mirror: LegacyMirror): LegacyMirror {
  legacySink?.(mirror);
  return mirror;
}

// ─── Internal mutable state ───────────────────────────────────────────────────
let entities = new Map<string, SelectionEntry>();
let primaryId: string | null = null;

// Derived caches (rebuilt once per mutation → reference-stable snapshots).
let cachedAllIds: string[] = EMPTY_IDS;
let cachedEntries: SelectionEntry[] = Object.freeze([]) as unknown as SelectionEntry[];
let cachedDxfIds: string[] = EMPTY_IDS;
let cachedOverlayRegionIds: string[] = EMPTY_IDS;
let cachedByType = new Map<string, string[]>();

// SSoT pub/sub via createExternalStore (WAVE 2.6). The Map + derived caches above
// stay as plain module `let`s (mutation accelerators); the store carries ONLY the
// version-signal integer that `useSyncExternalStore` consumers key off.
const store = createExternalStore<number>(0);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** region/overlay are aliases (see matchesEntityType); normalize for bucketing. */
function normalizeType(type: SelectableEntityType): string {
  return type === 'region' ? 'overlay' : type;
}

function isOverlayRegion(type: SelectableEntityType): boolean {
  return type === 'overlay' || type === 'region';
}

function rebuildCaches(): void {
  cachedAllIds = entities.size === 0 ? EMPTY_IDS : Array.from(entities.keys());
  cachedEntries = entities.size === 0
    ? (Object.freeze([]) as unknown as SelectionEntry[])
    : Array.from(entities.values());

  const byType = new Map<string, string[]>();
  for (const entry of entities.values()) {
    const key = normalizeType(entry.type);
    const arr = byType.get(key);
    if (arr) arr.push(entry.id);
    else byType.set(key, [entry.id]);
  }
  cachedByType = byType;
  cachedDxfIds = byType.get('dxf-entity') ?? EMPTY_IDS;
  cachedOverlayRegionIds = byType.get('overlay') ?? EMPTY_IDS;
}

function commit(): void {
  rebuildCaches();
  store.set(store.get() + 1);
}

/** Legacy mirror for an action that touched overlay/region selection. */
function overlayMirror(resetEditing: boolean): LegacyMirror {
  return { regionIdsChanged: true, regionIds: cachedOverlayRegionIds.slice(), resetEditing };
}

// ─── Mutators (return LegacyMirror; replicate the old UNIVERSAL_* reducer) ─────

function selectEntity(payload: SelectionPayload): LegacyMirror {
  const entry = createSelectionEntry(payload);
  entities = new Map([[entry.id, entry]]);
  primaryId = entry.id;
  commit();
  // SELECT replaces everything + always resets region-edit (old reducer parity).
  return applyAndReturn(isOverlayRegion(payload.type)
    ? overlayMirror(true)
    : { regionIdsChanged: false, regionIds: EMPTY_IDS, resetEditing: true });
}

function selectEntities(payloads: SelectionPayload[]): LegacyMirror {
  entities = new Map();
  for (const p of payloads) {
    const entry = createSelectionEntry(p);
    entities.set(entry.id, entry);
  }
  primaryId = payloads.length > 0 ? payloads[0].id : null;
  commit();
  const touched = payloads.some((p) => isOverlayRegion(p.type));
  return applyAndReturn(touched
    ? overlayMirror(true)
    : { regionIdsChanged: false, regionIds: EMPTY_IDS, resetEditing: true });
}

function addEntity(payload: SelectionPayload): LegacyMirror {
  const entry = createSelectionEntry(payload);
  entities = new Map(entities);
  entities.set(entry.id, entry);
  primaryId = entry.id;
  commit();
  return applyAndReturn(isOverlayRegion(payload.type) ? overlayMirror(false) : NO_MIRROR);
}

function addEntities(payloads: SelectionPayload[]): LegacyMirror {
  if (payloads.length === 0) return applyAndReturn(NO_MIRROR);
  entities = new Map(entities);
  for (const p of payloads) {
    const entry = createSelectionEntry(p);
    entities.set(entry.id, entry);
  }
  primaryId = payloads[payloads.length - 1].id;
  commit();
  const touched = payloads.some((p) => isOverlayRegion(p.type));
  return applyAndReturn(touched ? overlayMirror(false) : NO_MIRROR);
}

function deselectEntity(id: string): LegacyMirror {
  const removed = entities.get(id);
  if (!removed) return applyAndReturn(NO_MIRROR);
  entities = new Map(entities);
  entities.delete(id);
  if (primaryId === id) {
    const remaining = Array.from(entities.keys());
    primaryId = remaining.length > 0 ? remaining[0] : null;
  }
  commit();
  return applyAndReturn(isOverlayRegion(removed.type) ? overlayMirror(false) : NO_MIRROR);
}

// NOTE: delegates to deselectEntity/addEntity which already fire the sink — do NOT
// wrap again here (would double-dispatch the mirror).
function toggleEntity(payload: SelectionPayload): LegacyMirror {
  return entities.has(payload.id) ? deselectEntity(payload.id) : addEntity(payload);
}

function clearAll(): LegacyMirror {
  if (entities.size === 0 && primaryId === null) {
    return applyAndReturn({ regionIdsChanged: true, regionIds: EMPTY_IDS, resetEditing: true });
  }
  entities = new Map();
  primaryId = null;
  commit();
  return applyAndReturn({ regionIdsChanged: true, regionIds: EMPTY_IDS, resetEditing: true });
}

function clearByType(type: SelectableEntityType): LegacyMirror {
  let changed = false;
  const next = new Map<string, SelectionEntry>();
  for (const [id, entry] of entities) {
    if (matchesEntityType(entry.type, type)) changed = true;
    else next.set(id, entry);
  }
  if (!changed) return applyAndReturn(NO_MIRROR);
  entities = next;
  if (primaryId && !entities.has(primaryId)) {
    const remaining = Array.from(entities.keys());
    primaryId = remaining.length > 0 ? remaining[0] : null;
  }
  commit();
  return applyAndReturn(isOverlayRegion(type) ? overlayMirror(false) : NO_MIRROR);
}

/**
 * Atomically replace the dxf-entity selection (keep overlay/region entries).
 * Skip-if-unchanged: identical dxf set → no-op (no notify) so the 3D bridge /
 * layer-select round-trips don't loop. Mirrors the old
 * `clearByType('dxf-entity') + addEntities(...)` pair but as one transaction.
 */
function replaceEntitySelection(entityIds: string[]): LegacyMirror {
  const sameLength = entityIds.length === cachedDxfIds.length;
  if (sameLength && entityIds.every((id) => entities.get(id)?.type === 'dxf-entity')) {
    return applyAndReturn(NO_MIRROR); // identical dxf set already selected
  }
  const next = new Map<string, SelectionEntry>();
  for (const [id, entry] of entities) {
    if (entry.type !== 'dxf-entity') next.set(id, entry);
  }
  for (const id of entityIds) {
    const entry = createSelectionEntry({ id, type: 'dxf-entity' });
    next.set(id, entry);
  }
  entities = next;
  primaryId = entityIds.length > 0
    ? entityIds[entityIds.length - 1]
    : (Array.from(entities.keys())[0] ?? null);
  commit();
  return applyAndReturn(NO_MIRROR); // only dxf-entity touched → legacy region state unchanged
}

// ─── Getters (reference-stable snapshots) ──────────────────────────────────────

function getMap(): Map<string, SelectionEntry> { return entities; }
function getPrimaryId(): string | null { return primaryId; }
function isSelected(id: string): boolean { return entities.has(id); }
function getEntries(): SelectionEntry[] { return cachedEntries; }
function getIds(): string[] { return cachedAllIds; }
function getSelectedEntityIds(): string[] { return cachedDxfIds; }
function getOverlayRegionIds(): string[] { return cachedOverlayRegionIds; }
function count(): number { return entities.size; }

function getIdsByType(type: SelectableEntityType): string[] {
  return cachedByType.get(normalizeType(type)) ?? EMPTY_IDS;
}

function getByType(type: SelectableEntityType): SelectionEntry[] {
  return cachedEntries.filter((e) => matchesEntityType(e.type, type));
}

function countByType(type: SelectableEntityType): number {
  return getIdsByType(type).length;
}

function getVersion(): number { return store.get(); }

function subscribe(cb: Listener): () => void {
  return store.subscribe(cb);
}

/** Test-only: reset to empty (soft — does NOT clear listeners, unlike
 *  `store.reset`, so `renderHook` subscriptions stay valid across resets) +
 *  drop any registered legacy sink. */
function _resetForTests(): void {
  entities = new Map();
  primaryId = null;
  store.set(0);
  legacySink = null;
  rebuildCaches();
}

// ─── Facade (mirror TransformStore) ────────────────────────────────────────────
export const SelectedEntitiesStore = {
  // mutators
  selectEntity, selectEntities, addEntity, addEntities,
  deselectEntity, toggleEntity, clearAll, clearByType, replaceEntitySelection,
  // getters
  getMap, getPrimaryId, isSelected, getEntries, getIds, getSelectedEntityIds,
  getOverlayRegionIds, getIdsByType, getByType, count, countByType,
  // subscription
  getVersion, subscribe,
  // legacy mirror sink (ADR-532 Stage B — provider-owned)
  registerLegacySink,
  // test
  _resetForTests,
} as const;

// Named exports for stable module-level refs in useSyncExternalStore hooks.
export {
  subscribe as subscribeSelection,
  getVersion as getSelectionVersion,
  getPrimaryId as getStorePrimaryId,
  getEntries as getStoreSelectionEntries,
  getSelectedEntityIds as getStoreSelectedEntityIds,
  isSelected as isStoreSelected,
  getIdsByType as getStoreIdsByType,
  count as getStoreSelectionCount,
};
