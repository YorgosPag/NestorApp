'use client';

/**
 * material-appearance-thumbnail-store — ADR-687 Φ6. Reactive cache of rendered
 * material thumbnails, keyed by appearance signature. Mirrors `material-thumbnail-
 * resolver.ts` (the slug-albedo store): a module-level `Map` + `useSyncExternalStore`
 * + a convenience hook, with fire-and-forget generation + a version bump on resolve.
 *
 * The swatch (`MaterialSwatch`) calls `useMaterialAppearanceThumbnail(def)`; the first
 * time a signature is seen the offscreen sphere renders it (once), caches the PNG data
 * URL, and re-renders the subscribers. Identical appearances share one cached thumbnail.
 *
 * @see ./material-thumbnail-sphere.ts — the offscreen renderer (renderAppearanceThumbnail)
 * @see ../../bim/materials/material-thumbnail-resolver.ts — the mirrored slug-albedo store
 */

import { useEffect, useSyncExternalStore } from 'react';
import { createExternalStore } from '../../stores/createExternalStore';
import type { PbrMaterialDef } from '../../bim/materials/material-catalog-defs';
import type { LoadedTextureSet } from '../materials/bim-texture-cache';
import { renderAppearanceThumbnail } from './material-thumbnail-sphere';

/**
 * Stable signature of a def's visual fields (+ ADR-687 Φ7 an optional texture set) — the
 * cache key. Any change (colour, gloss, metal, opacity, emissive, a Φ5 physical prop, or the
 * loaded albedo texture) yields a new key → a fresh thumbnail. The albedo's `uuid` is stable
 * per loaded texture and changes on re-upload, so a re-textured material re-renders.
 */
export function appearanceThumbnailSignature(def: PbrMaterialDef, set?: LoadedTextureSet | null): string {
  return [
    def.color, def.roughness, def.metalness, def.opacity ?? 1,
    def.emissive ?? 0, def.emissiveIntensity ?? 1,
    def.clearcoat ?? 0, def.clearcoatRoughness ?? 0,
    def.transmission ?? 0, def.ior ?? 1.5, def.thickness ?? 0,
    set ? `tex:${set.map.uuid}` : '∅',
  ].join('|');
}

const urls = new Map<string, string>();     // signature → PNG data URL
const failed = new Set<string>();           // signatures whose render returned null (don't retry every render)
// Version-signal store (create-external-store SSoT): the Map/Set stay as mutation
// accelerators; a monotonic counter drives the useSyncExternalStore re-renders.
const versionSignal = createExternalStore<number>(0);

function emit(): void {
  versionSignal.set(versionSignal.get() + 1);
}

/** Render one signature (idempotent). Caches the data URL + emits, or records a failure. */
function preload(sig: string, def: PbrMaterialDef, set?: LoadedTextureSet | null): void {
  if (urls.has(sig) || failed.has(sig)) return;
  const url = renderAppearanceThumbnail(def, set ?? null);
  if (url) {
    urls.set(sig, url);
    emit();
  } else {
    failed.add(sig); // no-WebGL / draw failure → swatch keeps its flat fallback
  }
}

export const materialAppearanceThumbnailStore = {
  preload,
  getUrl: (sig: string): string | undefined => urls.get(sig),
  /** React subscription — a version number that bumps on each resolve. */
  use(): number {
    return useSyncExternalStore(versionSignal.subscribe, versionSignal.get, () => 0);
  },
};

/**
 * Reactive hook: the rendered thumbnail data URL for a def (+ ADR-687 Φ7 an optional loaded
 * texture set) — or `null` while unresolved / when `def` is null / when offscreen rendering
 * is unavailable. Triggers the render on mount / def / texture change. When `set` is null (a
 * textured material whose maps are still loading) the flat thumbnail renders now; once the
 * caller passes the loaded set (after a `textureAssetVersion` bump) the textured one renders.
 */
export function useMaterialAppearanceThumbnail(
  def: PbrMaterialDef | null,
  set: LoadedTextureSet | null = null,
): string | null {
  materialAppearanceThumbnailStore.use();
  const sig = def ? appearanceThumbnailSignature(def, set) : null;
  useEffect(() => {
    if (def && sig) materialAppearanceThumbnailStore.preload(sig, def, set);
  }, [def, sig, set]);
  return sig ? materialAppearanceThumbnailStore.getUrl(sig) ?? null : null;
}

/** Test-only — clear the cache between specs. */
export function __resetMaterialAppearanceThumbnailStoreForTests(): void {
  urls.clear();
  failed.clear();
  versionSignal.reset(0);
}
