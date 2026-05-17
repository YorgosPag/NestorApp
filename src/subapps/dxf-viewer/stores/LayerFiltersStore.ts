/**
 * LayerFiltersStore — micro-leaf SSoT for Layer Filters runtime state
 * (ADR-358 §5.7.bis Q11, Phase 11).
 *
 * Sibling of `LayerStore`. Holds: user-created + imported filters (persisted),
 * derived smart filters (re-computed on LayerStore snapshot bump), active
 * filter combo (Shift=AND / Ctrl=OR multi-select, cap `ACTIVE_FILTERS_MAX`),
 * pinned smart filter ids (user-scoped via localStorage), hydration status.
 *
 * Performance: `Map<filterId, Set<layerId>>` derivation cache invalidated on
 * LayerStore version bump or filter mutation. Pure-fn engine
 * (`layer-filter-engine.ts`) is the SSoT — this store is the memoization
 * layer + combo state machine.
 *
 * Lifecycle:
 *   - `setProjectId(projectId)` → attach persistence listener, hydrate.
 *   - `clearProject()` → detach, reset.
 *   - Subscribers via `subscribeLayerFiltersStore` + `getLayerFiltersStoreSnapshot`
 *     (useSyncExternalStore-compatible).
 *
 * Pattern reference: `LayerStore.ts`, `IsolateEffectsStore.ts`.
 */

import {
  getLayerStoreSnapshot,
  subscribeLayerStore,
  type LayerStoreSnapshot,
} from './LayerStore';
import {
  ACTIVE_FILTERS_MAX,
  type ActiveLayerFilterEntry,
  type LayerFilter,
  type LayerFilterCombinator,
} from '../types/layer-filters';
import { getMatchingLayerIds } from '../services/layer-filter-engine';
import { getSmartFilters } from '../services/layer-smart-filters';
import {
  deleteFilter as persistDelete,
  replaceProjectFilters as persistReplace,
  saveFilter as persistSave,
  subscribeProjectFilters,
  type FilterPersistenceHandle,
} from '../services/layer-filter-persistence';

type Listener = () => void;

const PINNED_STORAGE_PREFIX = 'dxf:pinnedSmartFilters';

export type HydrationStatus = 'idle' | 'hydrating' | 'ready';

export interface LayerFiltersSnapshot {
  readonly projectId: string | null;
  readonly userFilters: ReadonlyArray<LayerFilter>;
  readonly smartFilters: ReadonlyArray<LayerFilter>;
  readonly allFiltersById: ReadonlyMap<string, LayerFilter>;
  readonly activeFilters: ReadonlyArray<ActiveLayerFilterEntry>;
  readonly pinnedSmartIds: ReadonlyArray<string>;
  readonly hydrationStatus: HydrationStatus;
}

const EMPTY_SNAPSHOT: LayerFiltersSnapshot = Object.freeze({
  projectId: null,
  userFilters: Object.freeze([]) as ReadonlyArray<LayerFilter>,
  smartFilters: Object.freeze([]) as ReadonlyArray<LayerFilter>,
  allFiltersById: new Map(),
  activeFilters: Object.freeze([]) as ReadonlyArray<ActiveLayerFilterEntry>,
  pinnedSmartIds: Object.freeze([]) as ReadonlyArray<string>,
  hydrationStatus: 'idle',
});

// ─── State (singleton) ───────────────────────────────────────────────────────

let projectId: string | null = null;
let userFilters: ReadonlyArray<LayerFilter> = [];
let smartFilters: ReadonlyArray<LayerFilter> = [];
let activeFilters: ReadonlyArray<ActiveLayerFilterEntry> = [];
let pinnedSmartIds: ReadonlyArray<string> = [];
let hydrationStatus: HydrationStatus = 'idle';
let cached: LayerFiltersSnapshot = EMPTY_SNAPSHOT;
let persistenceHandle: FilterPersistenceHandle | null = null;
let layerStoreUnsub: (() => void) | null = null;
let lastLayerStoreVersion = -1;

const subscribers = new Set<Listener>();

/** Derived layer-id cache. Key = filterId; value = matching ids set. */
const matchCache = new Map<string, ReadonlySet<string>>();

// ─── Snapshot getter (useSyncExternalStore-compatible) ───────────────────────

export function getLayerFiltersStoreSnapshot(): LayerFiltersSnapshot {
  return cached;
}

export function subscribeLayerFiltersStore(cb: Listener): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

/**
 * Attach to a project. Idempotent — calling with the same projectId is a
 * no-op. Calling with a new projectId detaches the previous listener first.
 */
export function setProjectId(nextProjectId: string | null): void {
  if (nextProjectId === projectId) return;
  detachPersistence();
  projectId = nextProjectId;
  pinnedSmartIds = readPinnedFromStorage(nextProjectId);
  if (nextProjectId === null) {
    userFilters = [];
    activeFilters = [];
    hydrationStatus = 'idle';
    invalidateCache();
    rebuildAndNotify();
    return;
  }
  hydrationStatus = 'hydrating';
  ensureLayerStoreSubscription();
  rebuildSmartFilters();
  rebuildAndNotify();
  persistenceHandle = subscribeProjectFilters(nextProjectId, (filters) => {
    userFilters = filters;
    hydrationStatus = 'ready';
    invalidateCache();
    rebuildAndNotify();
  });
}

export function clearProject(): void {
  setProjectId(null);
}

// ─── Filter mutations (persisted) ────────────────────────────────────────────

export function upsertUserFilter(filter: LayerFilter): void {
  if (filter.source === 'system-smart') return;
  if (!projectId) return;
  persistSave(projectId, filter);
  // Persistence layer will re-emit; we drop the cached entry for this id now
  // so the next selector call recomputes immediately for any optimistic read.
  matchCache.delete(filter.id);
}

export function removeUserFilter(filterId: string): void {
  if (!projectId) return;
  persistDelete(projectId, filterId);
  matchCache.delete(filterId);
  // Drop from active list if present.
  const nextActive = activeFilters.filter((e) => e.filterId !== filterId);
  if (nextActive.length !== activeFilters.length) {
    activeFilters = nextActive;
    rebuildAndNotify();
  }
}

export function replaceUserFilters(filters: ReadonlyArray<LayerFilter>): void {
  if (!projectId) return;
  persistReplace(projectId, filters);
  invalidateCache();
}

// ─── Active filter combo (state machine) ─────────────────────────────────────

export type FilterSelectionModifier = 'none' | 'shift' | 'ctrl';

/**
 * Combo state machine.
 *   - `none`  → replace active list with `[{filterId, 'AND'}]`.
 *   - `shift` → toggle: if present, remove; else append AND (cap respected).
 *   - `ctrl`  → flip-or-append: if present, flip combinator; else append OR.
 */
export function selectFilter(filterId: string, modifier: FilterSelectionModifier): void {
  const present = activeFilters.find((e) => e.filterId === filterId);

  if (modifier === 'none') {
    activeFilters = [{ filterId, combinator: 'AND' }];
    notifyOnly();
    return;
  }

  if (modifier === 'shift') {
    activeFilters = present
      ? activeFilters.filter((e) => e.filterId !== filterId)
      : appendActive(filterId, 'AND');
    notifyOnly();
    return;
  }

  // ctrl
  if (present) {
    activeFilters = activeFilters.map((e) =>
      e.filterId === filterId
        ? { filterId: e.filterId, combinator: flipCombinator(e.combinator) }
        : e,
    );
  } else {
    activeFilters = appendActive(filterId, 'OR');
  }
  notifyOnly();
}

export function clearActiveFilters(): void {
  if (activeFilters.length === 0) return;
  activeFilters = [];
  notifyOnly();
}

// ─── Pinned smart filters (user-scoped, localStorage) ────────────────────────

export function togglePinnedSmart(smartId: string): void {
  const isPinned = pinnedSmartIds.includes(smartId);
  pinnedSmartIds = isPinned
    ? pinnedSmartIds.filter((id) => id !== smartId)
    : [...pinnedSmartIds, smartId];
  writePinnedToStorage(projectId, pinnedSmartIds);
  notifyOnly();
}

// ─── Derived selector — filtered layer ids ───────────────────────────────────

/**
 * Compute the union/intersection of active filter results. Returns `null`
 * when no filter is active (pass-through). Result is recomputed lazily on
 * snapshot change (cache invalidated by LayerStore version diff).
 */
export function getFilteredLayerIds(): ReadonlySet<string> | null {
  if (activeFilters.length === 0) return null;
  const snapshot = getLayerStoreSnapshot();

  // Cheap LayerStore-version diff invalidation.
  if (snapshot.version !== lastLayerStoreVersion) {
    matchCache.clear();
    lastLayerStoreVersion = snapshot.version;
  }

  const first = activeFilters[0];
  let result = computeOrGet(first.filterId, snapshot);

  for (let i = 1; i < activeFilters.length; i += 1) {
    const next = activeFilters[i];
    const nextSet = computeOrGet(next.filterId, snapshot);
    result = next.combinator === 'AND' ? intersect(result, nextSet) : union(result, nextSet);
  }

  return result;
}

// ─── Internals ───────────────────────────────────────────────────────────────

function ensureLayerStoreSubscription(): void {
  if (layerStoreUnsub) return;
  layerStoreUnsub = subscribeLayerStore(() => {
    // LayerStore snapshot bumped — invalidate match cache, recompute smart
    // filter set (categories may have appeared/disappeared).
    invalidateCache();
    rebuildSmartFilters();
    rebuildAndNotify();
  });
}

function detachPersistence(): void {
  if (persistenceHandle) {
    persistenceHandle.unsubscribe();
    persistenceHandle = null;
  }
}

function invalidateCache(): void {
  matchCache.clear();
  lastLayerStoreVersion = -1;
}

function rebuildSmartFilters(): void {
  smartFilters = getSmartFilters(getLayerStoreSnapshot());
}

function rebuildAndNotify(): void {
  cached = buildSnapshot();
  notifyOnly();
}

function buildSnapshot(): LayerFiltersSnapshot {
  const all = new Map<string, LayerFilter>();
  for (const f of smartFilters) all.set(f.id, f);
  for (const f of userFilters) all.set(f.id, f);
  return Object.freeze({
    projectId,
    userFilters,
    smartFilters,
    allFiltersById: all,
    activeFilters,
    pinnedSmartIds,
    hydrationStatus,
  });
}

function notifyOnly(): void {
  cached = buildSnapshot();
  subscribers.forEach((cb) => cb());
}

function appendActive(
  filterId: string,
  combinator: LayerFilterCombinator,
): ReadonlyArray<ActiveLayerFilterEntry> {
  if (activeFilters.length >= ACTIVE_FILTERS_MAX) return activeFilters;
  return [...activeFilters, { filterId, combinator }];
}

function flipCombinator(c: LayerFilterCombinator): LayerFilterCombinator {
  return c === 'AND' ? 'OR' : 'AND';
}

function computeOrGet(
  filterId: string,
  snapshot: LayerStoreSnapshot,
): ReadonlySet<string> {
  const cachedSet = matchCache.get(filterId);
  if (cachedSet) return cachedSet;
  const filter = cached.allFiltersById.get(filterId);
  if (!filter) {
    const empty = new Set<string>();
    matchCache.set(filterId, empty);
    return empty;
  }
  const ids = getMatchingLayerIds({ filter, layers: snapshot.layers, snapshot });
  matchCache.set(filterId, ids);
  return ids;
}

function intersect(a: ReadonlySet<string>, b: ReadonlySet<string>): ReadonlySet<string> {
  if (a.size === 0 || b.size === 0) return new Set();
  const out = new Set<string>();
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const id of small) {
    if (large.has(id)) out.add(id);
  }
  return out;
}

function union(a: ReadonlySet<string>, b: ReadonlySet<string>): ReadonlySet<string> {
  const out = new Set<string>(a);
  for (const id of b) out.add(id);
  return out;
}

// ─── Pinned smart — localStorage I/O (user-scoped, per-project) ──────────────

function pinnedStorageKey(pid: string | null): string {
  return `${PINNED_STORAGE_PREFIX}:${pid ?? 'global'}`;
}

function readPinnedFromStorage(pid: string | null): ReadonlyArray<string> {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(pinnedStorageKey(pid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writePinnedToStorage(pid: string | null, ids: ReadonlyArray<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(pinnedStorageKey(pid), JSON.stringify(ids));
  } catch {
    // SSR / private mode → silent.
  }
}

// ─── Test-only reset ─────────────────────────────────────────────────────────

/** @internal Reset to empty state. Tests only. */
export function __resetLayerFiltersStoreForTesting(): void {
  detachPersistence();
  if (layerStoreUnsub) {
    layerStoreUnsub();
    layerStoreUnsub = null;
  }
  projectId = null;
  userFilters = [];
  smartFilters = [];
  activeFilters = [];
  pinnedSmartIds = [];
  hydrationStatus = 'idle';
  matchCache.clear();
  lastLayerStoreVersion = -1;
  cached = EMPTY_SNAPSHOT;
  subscribers.clear();
}
