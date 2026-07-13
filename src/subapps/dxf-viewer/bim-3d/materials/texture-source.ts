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
 * Flip with `setTextureSourceMode('storage')` WITHOUT touching any consumer
 * (cache/material catalog import only `resolveTextureUrl`).
 *
 * ADR-654: ο ΜΗΧΑΝΙΣΜΟΣ (mode switch + in-flight de-dup) ζει πλέον στο
 * `createAssetSourceResolver` — τον μοιράζεται με τη βιβλιοθήκη επίπλων κάτοψης.
 * Εδώ μένει ΜΟΝΟ η ταυτότητα της PBR βιβλιοθήκης (roots, path convention, env flag).
 *
 * Mirrors the SSoT decoupling of `bim-mesh-url-resolver.ts` (ADR-411).
 *
 * @see ../../systems/assets/create-asset-source-resolver.ts — ο κοινός μηχανισμός
 * @see docs/centralized-systems/reference/adrs/ADR-413-pbr-textures.md
 */

import {
  createAssetSourceResolver,
  type AssetSourceMode,
} from '../../systems/assets/create-asset-source-resolver';
import type { PbrTextureMapName } from '../../bim/materials/bim-texture-registry';

/**
 * PBR texture map channels. Alias of the registry union (ADR-653) — the registry
 * owns it because it is pure data that plain-node scripts must read, while THIS
 * module pulls in `firebase/storage`.
 */
export type TextureMap = PbrTextureMapName;

/** Where texture files are served from. */
export type TextureSourceMode = AssetSourceMode;

/** Root Storage folder for the CC0 PBR texture library (storage mode). */
export const BIM_TEXTURE_LIBRARY_ROOT = 'bim-texture-library';

/** Public-served root path for bundled textures (public mode). */
export const BIM_TEXTURE_PUBLIC_ROOT = '/textures';

// ── Module-level switch (Giorgio requirement: flip without code changes) ─────
// Default: 'storage' in production (textures live in Firebase Storage, not in the
// Vercel bundle — *.jpg are .gitignored). Override with NEXT_PUBLIC_BIM_TEXTURE_SOURCE.
const _envMode = process.env.NEXT_PUBLIC_BIM_TEXTURE_SOURCE as TextureSourceMode | undefined;

const resolver = createAssetSourceResolver({
  publicRoot: BIM_TEXTURE_PUBLIC_ROOT,
  storageRoot: BIM_TEXTURE_LIBRARY_ROOT,
  initialMode: _envMode ?? (process.env.NODE_ENV === 'production' ? 'storage' : 'public'),
});

/** Switch the texture source mode for ALL subsequent resolutions. */
export function setTextureSourceMode(mode: TextureSourceMode): void {
  resolver.setMode(mode);
}

/** Current texture source mode (read-only accessor). */
export function getTextureSourceMode(): TextureSourceMode {
  return resolver.getMode();
}

/** Relative object path for a slug + map (shared by both modes). */
function texturePath(slug: string, map: TextureMap): string {
  return `${slug}/${map}.jpg`;
}

/**
 * Resolve a downloadable URL for one texture map of a slug. Returns null when the
 * file cannot be resolved (storage mode error) so callers degrade to flat
 * materials. The ONLY place that maps (slug, map) → a URL.
 */
export function resolveTextureUrl(slug: string, map: TextureMap): Promise<string | null> {
  return resolver.resolveUrl(texturePath(slug, map));
}
