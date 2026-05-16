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

type Listener = () => void;

interface LayerStoreSnapshot {
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
}

/** FIFO cap for recent-layer tracking — AutoCAD/Revit parity. */
export const RECENT_LAYERS_MAX = 10;

const EMPTY_SNAPSHOT: LayerStoreSnapshot = Object.freeze({
  layers: Object.freeze([]) as ReadonlyArray<SceneLayer>,
  currentLayerId: null,
  recentLayerIds: Object.freeze([]) as ReadonlyArray<string>,
});

let layersById: Map<string, SceneLayer> = new Map();
let layerOrder: string[] = [];
let currentLayerId: string | null = null;
let recentLayerIds: string[] = [];
let cachedSnapshot: LayerStoreSnapshot = EMPTY_SNAPSHOT;

const subscribers = new Set<Listener>();

function getLayerKey(layer: SceneLayer): string {
  return layer.id ?? layer.name;
}

function rebuildSnapshot(): void {
  const list: SceneLayer[] = [];
  for (const key of layerOrder) {
    const layer = layersById.get(key);
    if (layer) list.push(layer);
  }
  cachedSnapshot = Object.freeze({
    layers: Object.freeze(list) as ReadonlyArray<SceneLayer>,
    currentLayerId,
    recentLayerIds: Object.freeze(recentLayerIds.slice()) as ReadonlyArray<string>,
  });
}

function notify(): void {
  subscribers.forEach((cb) => cb());
}

// ─── Snapshot getter (useSyncExternalStore-compatible) ───────────────────────

export function getLayerStoreSnapshot(): LayerStoreSnapshot {
  return cachedSnapshot;
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export function subscribeLayerStore(cb: Listener): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export function getLayer(idOrName: string): SceneLayer | null {
  return layersById.get(idOrName) ?? null;
}

/**
 * Resolve an entity's layer NAME with id-first preference (ADR-358 Phase 9D-3).
 *
 * Dual-read transitional helper:
 *   1. If `entity.layerId` is set → look up SceneLayer by stable id (post-9C path).
 *   2. Fallback to legacy `entity.layer` name backref (pre-9D entities or unresolved id).
 *
 * Collapses to id-only after Phase 9D-5 final flip removes `entity.layer`.
 */
export function resolveEntityLayerName(
  entity: { layerId?: string; layer?: string } | null | undefined
): string | undefined {
  if (!entity) return undefined;
  if (entity.layerId) {
    const layer = layersById.get(entity.layerId);
    if (layer) return layer.name;
  }
  return entity.layer;
}

export function getAllLayers(): ReadonlyArray<SceneLayer> {
  return cachedSnapshot.layers;
}

export function getCurrentLayerId(): string | null {
  return currentLayerId;
}

export function getRecentLayerIds(): ReadonlyArray<string> {
  return cachedSnapshot.recentLayerIds;
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
  notify();
}

/** Upsert a single layer. Inserts at end if new; replaces if key matches. */
export function upsertLayer(layer: SceneLayer): void {
  const key = getLayerKey(layer);
  if (!layersById.has(key)) layerOrder.push(key);
  layersById.set(key, layer);
  rebuildSnapshot();
  notify();
}

/** Remove a layer by id-or-name key. No-op if missing. */
export function removeLayer(idOrName: string): void {
  if (!layersById.has(idOrName)) return;
  layersById.delete(idOrName);
  layerOrder = layerOrder.filter((k) => k !== idOrName);
  if (currentLayerId === idOrName) currentLayerId = null;
  recentLayerIds = recentLayerIds.filter((id) => id !== idOrName);
  rebuildSnapshot();
  notify();
}

/** Set the current layer id (Q3 unified — single SSoT for new-entity drawing). */
export function setCurrentLayerId(id: string | null): void {
  if (id === currentLayerId) return;
  if (id !== null && !layersById.has(id)) return;
  currentLayerId = id;
  if (id !== null) pushRecentInternal(id);
  rebuildSnapshot();
  notify();
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
  notify();
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
  notify();
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
  cachedSnapshot = EMPTY_SNAPSHOT;
  subscribers.clear();
}
