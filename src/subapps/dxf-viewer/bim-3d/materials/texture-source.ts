/**
 * Texture source resolver — ADR-413 (switchable public ↔ storage SSoT).
 *
 * The ONLY module that knows WHERE PBR texture files physically live. Two modes:
 *
 *   - 'public'  → files bundled under `public/textures/<slug>/<map>.jpg`, served
 *     at the site root (`/textures/...`). Synchronous-resolvable (no network).
 *   - 'storage' → files in Firebase Storage `bim-texture-library/<slug>/<map>.jpg`,
 *     resolved via `getDownloadURL`. In-flight Promises are de-duplicated.
 *
 * Default mode is 'public'. Flip with `setTextureSourceMode('storage')` WITHOUT
 * touching any consumer (cache/material catalog import only `resolveTextureUrl`).
 *
 * Mirrors the SSoT decoupling of `bim-mesh-url-resolver.ts` (ADR-411).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-413-pbr-textures.md
 */

import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

/** PBR texture map channels. */
export type TextureMap = 'albedo' | 'normal' | 'roughness' | 'ao' | 'displacement';

/** Where texture files are served from. */
export type TextureSourceMode = 'public' | 'storage';

/** Root Storage folder for the CC0 PBR texture library (storage mode). */
export const BIM_TEXTURE_LIBRARY_ROOT = 'bim-texture-library';

/** Public-served root path for bundled textures (public mode). */
export const BIM_TEXTURE_PUBLIC_ROOT = '/textures';

// ── Module-level switch (Giorgio requirement: flip without code changes) ─────
// Default: 'storage' in production (textures live in Firebase Storage, not in the
// Vercel bundle — *.jpg are .gitignored). Override with NEXT_PUBLIC_BIM_TEXTURE_SOURCE.
const _envMode = process.env.NEXT_PUBLIC_BIM_TEXTURE_SOURCE as TextureSourceMode | undefined;
let sourceMode: TextureSourceMode =
  _envMode ?? (process.env.NODE_ENV === 'production' ? 'storage' : 'public');

/** Switch the texture source mode for ALL subsequent resolutions. */
export function setTextureSourceMode(mode: TextureSourceMode): void {
  sourceMode = mode;
}

/** Current texture source mode (read-only accessor). */
export function getTextureSourceMode(): TextureSourceMode {
  return sourceMode;
}

/** Relative object path for a slug + map (shared by both modes). */
function texturePath(slug: string, map: TextureMap): string {
  return `${slug}/${map}.jpg`;
}

// ── Storage-mode in-flight de-duplication ────────────────────────────────────
const inFlight = new Map<string, Promise<string | null>>();

function resolveStorageUrl(slug: string, map: TextureMap): Promise<string | null> {
  const path = texturePath(slug, map);
  const existing = inFlight.get(path);
  if (existing) return existing;

  const promise = getDownloadURL(ref(storage, `${BIM_TEXTURE_LIBRARY_ROOT}/${path}`))
    .then((url): string | null => url)
    .catch((): string | null => {
      inFlight.delete(path);
      return null;
    });
  inFlight.set(path, promise);
  return promise;
}

/**
 * Resolve a downloadable URL for one texture map of a slug. Returns null when the
 * file cannot be resolved (storage mode error) so callers degrade to flat
 * materials. The ONLY place that maps (slug, map) → a URL.
 */
export function resolveTextureUrl(slug: string, map: TextureMap): Promise<string | null> {
  if (sourceMode === 'public') {
    return Promise.resolve(`${BIM_TEXTURE_PUBLIC_ROOT}/${texturePath(slug, map)}`);
  }
  return resolveStorageUrl(slug, map);
}
