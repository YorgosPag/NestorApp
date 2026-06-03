/**
 * bimMeshCache — entity-agnostic glTF cache (ADR-411, Option A from ADR-410).
 *
 * The bridge between the SYNCHRONOUS 3D sync loop (`BimSceneLayer.sync*`) and the
 * ASYNC glTF loader, shared by ALL mesh-based BIM entities (furniture, light
 * fixtures, …). A module-level singleton keyed by `category/assetId`:
 *
 *   - `preload(category, assetId)`   → async; resolves the Storage URL + loads
 *     the glTF + caches the template `THREE.Group` (and its 2D silhouette +
 *     top-edges). Idempotent (de-dups in-flight loads).
 *   - `getInstance(category, assetId)` → SYNC; returns a fresh clone of the
 *     cached template (or null on a cache miss).
 *   - `getSilhouette` / `getTopEdges`  → SYNC; the cached 2D plan projection.
 *
 * On a cache miss the sync loop draws a bounding-box placeholder and fires
 * `preload`; when the load resolves we bump the shared `meshAssetVersion` in the
 * entities store, whose `BimViewport3D` subscriber re-runs `resyncBimScene` (the
 * placeholder is replaced by the real mesh), and `markAllCanvasDirty()` repaints
 * the 2D canvas (rectangle → silhouette). One resync signal for every category
 * (ADR-411 Δ5).
 *
 * Generalises `furniture-gltf-cache.ts` (ADR-410), which now delegates here.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { resolveMeshUrl, meshAssetKey } from './bim-mesh-url-resolver';
import { useBim3DEntitiesStore } from '../../stores/Bim3DEntitiesStore';
import {
  computeTopSilhouette,
  computeTopEdges,
  type SilPoint,
  type SilSegment,
} from '../../../bim/mesh-library/mesh-silhouette';
import { markAllCanvasDirty } from '../../../rendering/core/frame-scheduler-api';

type CacheState = 'loading' | 'error';

const loader = new GLTFLoader();

/** key (`category/assetId`) → loaded template group (clone per instance). */
const templates = new Map<string, THREE.Group>();
/** key → in-flight / error marker (so we never double-load). */
const status = new Map<string, CacheState>();
/** key → top-view silhouette (plan meters) for the 2D footprint. */
const silhouettes = new Map<string, readonly SilPoint[]>();
/** key → top-view feature edges (plan meters) for 2D interior detail. */
const edges = new Map<string, readonly SilSegment[]>();

/**
 * Kick off (or no-op) an async load. Resolves silently; the loaded mesh becomes
 * available via `getInstance()` and the entities store is bumped to trigger a 3D
 * resync. Safe to call from a synchronous sync loop (fire-and-forget).
 */
function preload(category: string, assetId: string): void {
  const key = meshAssetKey(category, assetId);
  if (templates.has(key) || status.has(key)) return;
  status.set(key, 'loading');

  void resolveMeshUrl(category, assetId)
    .then((url) => loader.loadAsync(url))
    .then((gltf) => {
      templates.set(key, gltf.scene);
      // Derive the 2D plan silhouette + interior edges from the actual mesh
      // (per-asset representative footprint). Computed once; failures fall back
      // to the authored rectangle in the renderer.
      try {
        const sil = computeTopSilhouette(gltf.scene);
        if (sil.length >= 3) silhouettes.set(key, sil);
        const eg = computeTopEdges(gltf.scene);
        if (eg.length > 0) edges.set(key, eg);
      } catch {
        /* non-fatal — renderer falls back to the catalog rectangle */
      }
      status.delete(key);
      // One shared resync signal: 3D rebuild (bbox placeholder → real mesh) AND
      // 2D repaint (rectangle → silhouette). The 2D canvas is dirtied directly
      // since it does not subscribe to the entities store.
      useBim3DEntitiesStore.getState().bumpMeshAssetVersion();
      markAllCanvasDirty();
    })
    .catch(() => {
      // Leave an 'error' marker so we don't hammer Storage on every resync; the
      // bbox placeholder remains as the visible fallback.
      status.set(key, 'error');
    });
}

/** Return a fresh clone of the cached template, or null on a miss. */
function getInstance(category: string, assetId: string): THREE.Group | null {
  const template = templates.get(meshAssetKey(category, assetId)) ?? null;
  return template ? (template.clone(true) as THREE.Group) : null;
}

/** Top-view silhouette (plan meters) for an asset, or null if not yet computed. */
function getSilhouette(category: string, assetId: string): readonly SilPoint[] | null {
  return silhouettes.get(meshAssetKey(category, assetId)) ?? null;
}

/** Top-view feature edges (plan meters) for an asset, or null if not computed. */
function getTopEdges(category: string, assetId: string): readonly SilSegment[] | null {
  return edges.get(meshAssetKey(category, assetId)) ?? null;
}

export const bimMeshCache = {
  preload,
  getInstance,
  getSilhouette,
  getTopEdges,
};

/** Test-only — reset cache between specs. */
export function __resetBimMeshCacheForTests(): void {
  templates.clear();
  status.clear();
  silhouettes.clear();
  edges.clear();
}
