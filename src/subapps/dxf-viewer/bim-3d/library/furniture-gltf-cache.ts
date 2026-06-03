/**
 * FurnitureGltfCache (ADR-410 decision 1, Option A).
 *
 * The bridge between the SYNCHRONOUS 3D sync loop (`BimSceneLayer.syncFurnitures`)
 * and the ASYNC glTF loader. A module-level singleton:
 *
 *   - `preload(assetId)`  → async; resolves the Storage URL + loads the glTF +
 *     caches the template `THREE.Group`. Idempotent (de-dups in-flight loads).
 *   - `get(assetId)`      → SYNC; returns the cached template Group (or null on a
 *     cache miss). The converter clones it per instance.
 *
 * On a cache miss the sync loop draws a bounding-box placeholder and fires
 * `preload`; when the load resolves we bump `furnitureAssetVersion` in the
 * entities store, whose `BimViewport3D` subscriber re-runs `resyncBimScene` —
 * the placeholder is then replaced by the real mesh (no manual scene mutation,
 * visibility filter intact).
 *
 * Mirrors the async-loader pattern of `lighting/envmap-generator.ts` (RGBELoader)
 * and the module-level Map cache of `comments/comment-marker-textures.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { resolveFurnitureMeshUrl } from './furniture-gltf-library';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { computeTopSilhouette, type SilPoint } from '../../bim/furniture/furniture-silhouette';
import { markAllCanvasDirty } from '../../rendering/core/frame-scheduler-api';

type CacheState = 'loading' | 'error';

const loader = new GLTFLoader();

/** assetId → loaded template group (clone per instance). */
const templates = new Map<string, THREE.Group>();
/** assetId → in-flight / error marker (so we never double-load). */
const status = new Map<string, CacheState>();
/** assetId → top-view silhouette (plan meters) for the 2D footprint (ADR-410). */
const silhouettes = new Map<string, readonly SilPoint[]>();

/**
 * Synchronously read the cached template group for an asset, or `null` on a
 * cache miss. Callers MUST clone before adding to the scene (shared template).
 */
function get(assetId: string): THREE.Group | null {
  return templates.get(assetId) ?? null;
}

/**
 * Kick off (or no-op) an async load for `assetId`. Resolves silently; the
 * loaded mesh becomes available via `get()` and the entities store is bumped to
 * trigger a 3D resync. Safe to call from a synchronous sync loop (fire-and-forget).
 */
function preload(assetId: string): void {
  if (templates.has(assetId) || status.has(assetId)) return;
  status.set(assetId, 'loading');

  void resolveFurnitureMeshUrl(assetId)
    .then((url) => loader.loadAsync(url))
    .then((gltf) => {
      templates.set(assetId, gltf.scene);
      // Derive the 2D plan silhouette from the actual mesh (ADR-410 — per-asset
      // representative footprint). Computed once; failures fall back to the
      // authored rectangle in the renderer.
      try {
        const sil = computeTopSilhouette(gltf.scene);
        if (sil.length >= 3) silhouettes.set(assetId, sil);
      } catch {
        /* non-fatal — renderer falls back to the catalog rectangle */
      }
      status.delete(assetId);
      // Trigger a 3D resync (bbox placeholder → real mesh) AND a 2D repaint
      // (rectangle → silhouette). The 2D canvas is dirtied directly since it does
      // not subscribe to the entities store.
      useBim3DEntitiesStore.getState().bumpFurnitureAssetVersion();
      markAllCanvasDirty();
    })
    .catch(() => {
      // Leave an 'error' marker so we don't hammer Storage on every resync; the
      // bbox placeholder remains as the visible fallback.
      status.set(assetId, 'error');
    });
}

/** Return a fresh clone of the cached template, or null on a miss. */
function getInstance(assetId: string): THREE.Group | null {
  const template = get(assetId);
  return template ? (template.clone(true) as THREE.Group) : null;
}

/** Top-view silhouette (plan meters) for an asset, or null if not yet computed. */
function getSilhouette(assetId: string): readonly SilPoint[] | null {
  return silhouettes.get(assetId) ?? null;
}

export const furnitureGltfCache = {
  preload,
  get,
  getInstance,
  getSilhouette,
};

/** Test-only — reset cache between specs. */
export function __resetFurnitureGltfCacheForTests(): void {
  templates.clear();
  status.clear();
  silhouettes.clear();
}
