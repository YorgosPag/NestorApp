/**
 * LayerStore — Unified Layer Management SSoT (ADR-358 §5.2 + §5.10 + Q3)
 *
 * Mutable singleton micro-leaf (ADR-040 pattern: useSyncExternalStore-compatible).
 * Owns `SceneLayer[]` (project-wide) + `currentLayerId` (formerly in `overlay-manager`).
 *
 * Phase 1 scope (foundation only):
 *   - Store contract + subscriptions.
 *   - No persistence yet (Phase 9 wires Firestore + localStorage).
 *   - No render-pipeline wire-up (Phase 4 ByLayer/ByBlock).
 *   - `overlay-manager.currentLayerId` migration happens in Phase 5 bridge — until then the
 *     two coexist; LayerStore is the SSoT going forward.
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
}

const EMPTY_SNAPSHOT: LayerStoreSnapshot = Object.freeze({
  layers: Object.freeze([]) as ReadonlyArray<SceneLayer>,
  currentLayerId: null,
});

let layersById: Map<string, SceneLayer> = new Map();
let layerOrder: string[] = [];
let currentLayerId: string | null = null;
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

export function getAllLayers(): ReadonlyArray<SceneLayer> {
  return cachedSnapshot.layers;
}

export function getCurrentLayerId(): string | null {
  return currentLayerId;
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
  rebuildSnapshot();
  notify();
}

/** Set the current layer id (Q3 unified — single SSoT for new-entity drawing). */
export function setCurrentLayerId(id: string | null): void {
  if (id === currentLayerId) return;
  if (id !== null && !layersById.has(id)) return;
  currentLayerId = id;
  rebuildSnapshot();
  notify();
}

// ─── Test-only reset (NOT exported from index — direct import only) ──────────

/** @internal Reset to empty state. Tests only. */
export function __resetLayerStoreForTesting(): void {
  layersById = new Map();
  layerOrder = [];
  currentLayerId = null;
  cachedSnapshot = EMPTY_SNAPSHOT;
  subscribers.clear();
}
