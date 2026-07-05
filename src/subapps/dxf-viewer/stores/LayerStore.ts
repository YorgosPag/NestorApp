/**
 * LayerStore — Unified Layer Management SSoT (ADR-358 §5.2 + §5.10 + Q3)
 *
 * Mutable singleton micro-leaf (ADR-040 pattern: useSyncExternalStore-compatible).
 * Owns `SceneLayer[]` (project-wide) + `currentLayerId` (formerly in `overlay-manager`).
 *
 * Scope:
 *   - Store contract + subscriptions (Phase 1).
 *   - Render-pipeline wire-up live (Phase 4-6 ByLayer/ByBlock).
 *   - `recentLayerIds` FIFO slice (Phase 7 §5.5.bis Q8). Persistence is owned
 *     by `ui/components/layer-picker/layer-picker-persistence.ts` — the store
 *     stays a pure micro-leaf with no I/O dependencies.
 *
 * Pre-commit ratchet `unified-layer-store` (in `.ssot-registry.json`) blocks direct
 * `RegionLayerObject` access and `overlay-manager.coreState.layers` reads outside
 * the bridge transition file.
 */

import type { SceneLayer } from '../types/entities';
import {
  getIsolateEffectsSnapshot
} from '../systems/isolate/IsolateEffectsStore';
import { dimOpacityToTransparency } from '../services/layer-isolate-resolver';
import { DXF_DEFAULT_LAYER } from '../config/layer-config';
import { createExternalStore } from './createExternalStore';

type Listener = () => void;

/**
 * Single-level snapshot of layer visibility state captured by
 * `LayerIsolateCommand.execute()` and restored by `LayerUnisolateCommand`.
 * ADR-358 §5.6.bis — snapshot is session-only (NOT persisted) and overwritten
 * by a second isolate (with warning toast at the command layer).
 *
 * NOTE: direct reads/writes of this field outside `core/commands/layer/**`
 * are forbidden by the pre-commit ratchet `layer-isolate-system`.
 */
export interface UnisolateSnapshotEntry {
  readonly layerId: string;
  readonly visible: boolean;
  readonly frozen: boolean;
  readonly locked: boolean;
  readonly transparency: number;
}

export type UnisolateSnapshot = ReadonlyArray<UnisolateSnapshotEntry> | null;

export interface LayerStoreSnapshot {
  /** Ordered list of layers — order reflects insertion/import (DXF table order). */
  readonly layers: ReadonlyArray<SceneLayer>;
  /** Current layer for new-entity creation. Null until first scene load. */
  readonly currentLayerId: string | null;
  /**
   * Recent layer ids (Q8 §5.5.bis). FIFO sliding window, most-recent first.
   * Max length `RECENT_LAYERS_MAX`. Persistence is project+user-scoped, owned
   * by `ui/components/layer-picker/layer-picker-persistence.ts`.
   */
  readonly recentLayerIds: ReadonlyArray<string>;
  /**
   * Monotonic snapshot version (ADR-358 Phase 11 — LayerFiltersStore cache invalidation).
   * Bumps on every `rebuildSnapshot()` call. Consumers use the diff to invalidate
   * derived caches (e.g. `Map<filterId, Set<layerId>>` in LayerFiltersStore).
   */
  readonly version: number;
}

/** FIFO cap for recent-layer tracking — AutoCAD/Revit parity. */
export const RECENT_LAYERS_MAX = 10;

const EMPTY_SNAPSHOT: LayerStoreSnapshot = Object.freeze({
  layers: Object.freeze([]) as ReadonlyArray<SceneLayer>,
  currentLayerId: null,
  recentLayerIds: Object.freeze([]) as ReadonlyArray<string>,
  version: 0,
});

let layersById: Map<string, SceneLayer> = new Map();
let layerOrder: string[] = [];
let currentLayerId: string | null = null;
let recentLayerIds: string[] = [];
let snapshotVersion = 0;
let unisolateSnapshot: UnisolateSnapshot = null;

// SSoT pub/sub via createExternalStore (WAVE 2.6). The Maps/lets above stay as
// mutation accelerators; `cachedSnapshot`/`subscribers`/`notify()` collapse into
// this single composite-snapshot store — `rebuildSnapshot()` still builds the
// derived object, but commits it via `store.set(...)` (always-notify, no `equals`).
const store = createExternalStore<LayerStoreSnapshot>(EMPTY_SNAPSHOT);

function getLayerKey(layer: SceneLayer): string {
  return layer.id ?? layer.name;
}

function rebuildSnapshot(): void {
  const list: SceneLayer[] = [];
  for (const key of layerOrder) {
    const layer = layersById.get(key);
    if (layer) list.push(layer);
  }
  snapshotVersion += 1;
  store.set(Object.freeze({
    layers: Object.freeze(list) as ReadonlyArray<SceneLayer>,
    currentLayerId,
    recentLayerIds: Object.freeze(recentLayerIds.slice()) as ReadonlyArray<string>,
    version: snapshotVersion,
  }));
}

// ─── Snapshot getter (useSyncExternalStore-compatible) ───────────────────────

export function getLayerStoreSnapshot(): LayerStoreSnapshot {
  return store.get();
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export function subscribeLayerStore(cb: Listener): () => void {
  return store.subscribe(cb);
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export function getLayer(idOrName: string): SceneLayer | null {
  return layersById.get(idOrName) ?? null;
}

/**
 * SSoT για το id του προεπιλεγμένου layer (`DXF_DEFAULT_LAYER`) — `''` αν δεν έχει αρχικοποιηθεί.
 * Πριν, το ίδιο one-liner (`getLayer(DXF_DEFAULT_LAYER)?.id ?? ''`) ήταν αντιγραμμένο σε 9+ preview
 * helpers (beam/column/foundation/slab/wall/line/xline/wall-covering/generator). Ζει εδώ μία φορά
 * (ADR-358 id-only WRITE)· οι preview helpers το καλούν αντί να ξανα-δηλώνουν τον getter.
 */
export function getDefaultLayerId(): string {
  return getLayer(DXF_DEFAULT_LAYER)?.id ?? '';
}

/** Find a layer by display name (O(n) scan). Use `getLayer(id)` when id is known. */
export function getLayerByName(name: string): SceneLayer | null {
  for (const layer of layersById.values()) {
    if (layer.name === name) return layer;
  }
  return null;
}

/**
 * Resolve an entity's layer NAME via stable id only (ADR-358 Phase 9D-5b-iii schema flip).
 *
 * Id-only post-schema-flip: `entity.layer` name backref no longer used.
 *   1. If `entity.layerId` is set AND registered in store → return layer name.
 *   2. Legacy fallback: if `entity.layer` (name backref) is present → return it.
 *      Covers pre-9F entities and unit-test mocks where the store singleton is empty.
 *   3. Otherwise → return undefined.
 */
export function resolveEntityLayerName(
  entity: { layerId?: string } | null | undefined
): string | undefined {
  if (!entity) return undefined;
  if (entity.layerId) {
    const layer = layersById.get(entity.layerId);
    if (layer) return layer.name;
  }
  return undefined;
}

export function getAllLayers(): ReadonlyArray<SceneLayer> {
  return store.get().layers;
}

/**
 * id- **και** name-keyed map των layers — η μορφή που περιμένει το color SSoT
 * (`resolveEntityStyle`/`resolveEntityColorHex`): id-keyed lookup με name fallback
 * για legacy/Firestore entities. SSoT ώστε οι caller να μην ξαναχτίζουν το map
 * (ADR-524 — μία πηγή για το «layers as Record»).
 */
export function getLayersById(): Record<string, SceneLayer> {
  const map: Record<string, SceneLayer> = {};
  for (const layer of store.get().layers) {
    if (layer.id) map[layer.id] = layer;
    if (layer.name) map[layer.name] = layer;
  }
  return map;
}

export function getCurrentLayerId(): string | null {
  return currentLayerId;
}

export function getRecentLayerIds(): ReadonlyArray<string> {
  return store.get().recentLayerIds;
}

// ─── Unisolate snapshot (ADR-358 §5.6.bis — single-level, session-only) ──────

/** Current isolate snapshot. Null when no isolate session is active. */
export function getUnisolateSnapshot(): UnisolateSnapshot {
  return unisolateSnapshot;
}

/**
 * Replace the unisolate snapshot. `LayerIsolateCommand` captures pre-state;
 * `LayerUnisolateCommand` clears it. No notify — snapshot is metadata-only,
 * has no visual effect until commands act on it.
 */
export function setUnisolateSnapshot(next: UnisolateSnapshot): void {
  unisolateSnapshot = next;
}

/** Clear the unisolate snapshot. Convenience alias for `setUnisolateSnapshot(null)`. */
export function clearUnisolateSnapshot(): void {
  unisolateSnapshot = null;
}

/**
 * Resolve the effective transparency for a layer at render-time.
 * Combines `layer.transparency` (0..90, ACI-aligned) with any active isolate
 * override from `IsolateEffectsStore`: when mode='dim' and `layerId` is NOT in
 * `isolatedLayerIds`, the layer is dimmed via `dimOpacityToTransparency()`.
 *
 * Returns 0 for non-existent layers (no transparency).
 */
export function getEffectiveTransparency(layerId: string): number {
  const layer = layersById.get(layerId);
  const base = layer?.transparency ?? 0;
  const isolate = getIsolateEffectsSnapshot();
  if (!isolate.active || isolate.mode !== 'dim') return base;
  if (isolate.isolatedLayerIds.has(layerId)) return base;
  return dimOpacityToTransparency(isolate.dimOpacityPercent);
}


// ─── Mutations ───────────────────────────────────────────────────────────────

/** Replace the entire layer set (DXF scene load, project switch). */
export function setLayers(next: ReadonlyArray<SceneLayer>): void {
  layersById = new Map();
  layerOrder = [];
  for (const layer of next) {
    const key = getLayerKey(layer);
    if (layersById.has(key)) continue;
    layersById.set(key, layer);
    layerOrder.push(key);
  }
  if (currentLayerId && !layersById.has(currentLayerId)) {
    currentLayerId = null;
  }
  recentLayerIds = recentLayerIds.filter((id) => layersById.has(id));
  rebuildSnapshot();
}

/** Upsert a single layer. Inserts at end if new; replaces if key matches. */
export function upsertLayer(layer: SceneLayer): void {
  const key = getLayerKey(layer);
  if (!layersById.has(key)) layerOrder.push(key);
  layersById.set(key, layer);
  rebuildSnapshot();
}

/** Remove a layer by id-or-name key. No-op if missing. */
export function removeLayer(idOrName: string): void {
  if (!layersById.has(idOrName)) return;
  layersById.delete(idOrName);
  layerOrder = layerOrder.filter((k) => k !== idOrName);
  if (currentLayerId === idOrName) currentLayerId = null;
  recentLayerIds = recentLayerIds.filter((id) => id !== idOrName);
  rebuildSnapshot();
}

/** Set the current layer id (Q3 unified — single SSoT for new-entity drawing). */
export function setCurrentLayerId(id: string | null): void {
  if (id === currentLayerId) return;
  if (id !== null && !layersById.has(id)) return;
  currentLayerId = id;
  if (id !== null) pushRecentInternal(id);
  rebuildSnapshot();
}

/**
 * Push a layer id to the most-recent slot. FIFO cap = RECENT_LAYERS_MAX.
 * Idempotent on duplicate top entry. Use when bridging external state
 * (e.g. AdminLayerManager "Set as current") without going through
 * `setCurrentLayerId`. Always validates against known layers.
 */
export function pushRecentLayer(id: string): void {
  if (!layersById.has(id)) return;
  if (recentLayerIds[0] === id) return;
  pushRecentInternal(id);
  rebuildSnapshot();
}

/**
 * Replace the recent-layers list (persistence hydration). Filters unknown
 * ids and trims to cap. Idempotent against current state.
 */
export function setRecentLayerIds(ids: ReadonlyArray<string>): void {
  const next: string[] = [];
  for (const id of ids) {
    if (next.length >= RECENT_LAYERS_MAX) break;
    if (!layersById.has(id)) continue;
    if (next.includes(id)) continue;
    next.push(id);
  }
  if (sameOrder(next, recentLayerIds)) return;
  recentLayerIds = next;
  rebuildSnapshot();
}

/**
 * Atomic snapshot apply (ADR-358 §5.9 Q12 Phase 12 — Restore command).
 *
 * Applies an array of partial layer state updates in a single notify cycle.
 * Each entry is matched by `layerId` first, then by case-insensitive
 * `layerName` fallback (cross-project `.las` restore semantics, Phase 13).
 * Layers absent from the snapshot are left untouched (extra layers as-is);
 * snapshot entries with no live match are reported back as `unmatched` so the
 * caller can surface a toast.
 */
export interface LayerSnapshotEntryInput {
  readonly layerId: string;
  readonly layerName: string;
  readonly visible: boolean;
  readonly frozen: boolean;
  readonly locked: boolean;
  readonly color: string;
  readonly colorAci?: number;
  readonly colorTrueColor?: number | null;
  readonly linetype: string;
  readonly lineweight: SceneLayer['lineweight'];
  readonly transparency: number;
  readonly plottable: boolean;
}

export interface ApplyLayerSnapshotResult {
  readonly applied: number;
  readonly unmatched: ReadonlyArray<string>;
}

export function applyLayerSnapshotEntries(
  entries: ReadonlyArray<LayerSnapshotEntryInput>,
): ApplyLayerSnapshotResult {
  let applied = 0;
  const unmatched: string[] = [];
  for (const entry of entries) {
    const target = matchLayerForSnapshotEntry(entry);
    if (!target) {
      unmatched.push(entry.layerName);
      continue;
    }
    const key = getLayerKey(target);
    layersById.set(key, {
      ...target,
      visible: entry.visible,
      frozen: entry.frozen,
      locked: entry.locked,
      color: entry.color,
      colorAci: entry.colorAci ?? target.colorAci,
      colorTrueColor:
        entry.colorTrueColor === undefined ? target.colorTrueColor : entry.colorTrueColor,
      linetype: entry.linetype,
      lineweight: entry.lineweight,
      transparency: entry.transparency,
      plottable: entry.plottable,
    });
    applied += 1;
  }
  if (applied > 0) {
    rebuildSnapshot();
  }
  return { applied, unmatched };
}

function matchLayerForSnapshotEntry(entry: LayerSnapshotEntryInput): SceneLayer | null {
  const byId = layersById.get(entry.layerId);
  if (byId) return byId;
  const needle = entry.layerName.toLowerCase();
  for (const layer of layersById.values()) {
    if (layer.name.toLowerCase() === needle) return layer;
  }
  return null;
}


function pushRecentInternal(id: string): void {
  const filtered = recentLayerIds.filter((existing) => existing !== id);
  filtered.unshift(id);
  if (filtered.length > RECENT_LAYERS_MAX) filtered.length = RECENT_LAYERS_MAX;
  recentLayerIds = filtered;
}

function sameOrder(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ─── Test-only reset (NOT exported from index — direct import only) ──────────

/** @internal Reset to empty state. Tests only. */
export function __resetLayerStoreForTesting(): void {
  layersById = new Map();
  layerOrder = [];
  currentLayerId = null;
  recentLayerIds = [];
  snapshotVersion = 0;
  unisolateSnapshot = null;
  store.reset(EMPTY_SNAPSHOT);
}
