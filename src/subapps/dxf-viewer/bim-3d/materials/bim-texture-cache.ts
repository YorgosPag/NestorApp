/**
 * bimTextureCache — PBR texture-set cache (ADR-413).
 *
 * The bridge between the SYNCHRONOUS 3D material lookup (`MaterialCatalog3D`) and
 * the ASYNC `THREE.TextureLoader`. Mirrors `bim-mesh-cache.ts` (ADR-411): a
 * module-level singleton keyed by texture slug.
 *
 *   - `preloadTextureSet(slug)` → async fire-and-forget; resolves each map URL
 *     (via the switchable `texture-source`) + loads + configures the textures +
 *     caches the set. Idempotent (de-dups via the `status` map).
 *   - `getTextureSet(slug)`     → SYNC; returns the loaded set, or null on a miss
 *     (caller uses the flat material + fires `preloadTextureSet`).
 *
 * On a full set load we bump the shared `textureAssetVersion` in the entities
 * store, whose `BimViewport3D` subscriber re-runs `resyncBimScene` so flat
 * materials are swapped for textured variants. One resync signal per slug.
 *
 * TILING: textures are configured with `repeat = 1 / tileSizeM`. Because geometry
 * UVs are authored in WORLD METERS (see `bim-uv-helpers.ts`), a single shared
 * texture singleton tiles physically across any mesh size — so we NEVER clone
 * textures per mesh.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-413-pbr-textures.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import * as THREE from 'three';
import { resolveTextureUrl, type TextureMap } from './texture-source';
import { TEXTURE_SET_DEFS, type PbrTextureSlug } from '../../bim/materials/bim-texture-registry';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { configurePbrTexture } from './pbr-texture-config';

/** A loaded PBR texture set. `map` (albedo) is always present; others optional. */
export interface LoadedTextureSet {
  readonly map: THREE.Texture;
  readonly normalMap?: THREE.Texture;
  readonly roughnessMap?: THREE.Texture;
  readonly aoMap?: THREE.Texture;
  /** Height/displacement map (data channel, NoColorSpace). Only for slugs with hasDisplacement=true. */
  readonly displacementMap?: THREE.Texture;
}

type CacheState = 'loading' | 'error';

const loader = new THREE.TextureLoader();

/** slug → loaded texture set (shared singleton; never cloned per mesh). */
const sets = new Map<string, LoadedTextureSet>();
/** slug → in-flight / error marker (so we never double-load or hammer on error). */
const status = new Map<string, CacheState>();

/** Is this slug a known registry slug? */
function isKnownSlug(slug: string): slug is PbrTextureSlug {
  return slug in TEXTURE_SET_DEFS;
}

/** Load + configure one map, or null if the source has no URL for it or the file is missing. */
async function loadMap(slug: PbrTextureSlug, map: TextureMap, tileSizeM: number): Promise<THREE.Texture | null> {
  const url = await resolveTextureUrl(slug, map);
  if (!url) return null;
  try {
    const tex = await loader.loadAsync(url);
    configurePbrTexture(tex, tileSizeM, map === 'albedo');
    return tex;
  } catch {
    // Optional map not available (404 / storage miss) — degrade gracefully.
    // Only a missing albedo makes the whole set unusable; the check below handles that.
    return null;
  }
}

/**
 * Kick off (or no-op) an async load of a texture set. Resolves silently; the set
 * becomes available via `getTextureSet()` and the entities store is bumped to
 * trigger a 3D resync. Safe to call from a synchronous lookup (fire-and-forget).
 */
export function preloadTextureSet(slug: string): void {
  if (sets.has(slug) || status.has(slug)) return;
  if (!isKnownSlug(slug)) return;
  status.set(slug, 'loading');

  const def = TEXTURE_SET_DEFS[slug];
  void (async (): Promise<void> => {
    const [albedo, normal, roughness, ao, displacement] = await Promise.all([
      loadMap(slug, 'albedo', def.tileSizeM),
      def.hasNormal ? loadMap(slug, 'normal', def.tileSizeM) : Promise.resolve(null),
      def.hasRoughness ? loadMap(slug, 'roughness', def.tileSizeM) : Promise.resolve(null),
      def.hasAo ? loadMap(slug, 'ao', def.tileSizeM) : Promise.resolve(null),
      def.hasDisplacement ? loadMap(slug, 'displacement', def.tileSizeM) : Promise.resolve(null),
    ]);
    // Albedo is mandatory — without it there is no textured material.
    if (!albedo) {
      status.set(slug, 'error');
      return;
    }
    sets.set(slug, {
      map: albedo,
      normalMap: normal ?? undefined,
      roughnessMap: roughness ?? undefined,
      aoMap: ao ?? undefined,
      displacementMap: displacement ?? undefined,
    });
    status.delete(slug);
    // One shared resync signal: flat material → textured variant on next sync.
    useBim3DEntitiesStore.getState().bumpTextureAssetVersion();
  })().catch(() => {
    // Leave an 'error' marker so we don't hammer the source on every resync; the
    // flat material remains as the visible fallback.
    status.set(slug, 'error');
  });
}

/** Synchronous read of a loaded texture set, or null on a miss / while loading. */
export function getTextureSet(slug: string): LoadedTextureSet | null {
  return sets.get(slug) ?? null;
}

/** Test-only — reset the cache between specs. */
export function __resetBimTextureCacheForTests(): void {
  sets.clear();
  status.clear();
}
