'use client';

/**
 * Material thumbnail resolver — ADR-413 §2D (the 2D appearance SSoT).
 *
 * Resolves the small preview image ("swatch") for a material picker entry. The
 * swatch IS the PBR `albedo.jpg` of the material's resolved texture slug — the
 * exact same image the 3D viewport paints — so the 2D chip always matches the 3D
 * render (one source of truth, zero extra assets).
 *
 * Two resolution entries:
 *   - `slugForMaterialId`   — DNA materialIds (`mat-concrete-c25` → slug 'concrete'),
 *     via the shared prefix resolver + the texture registry. The SAME path the
 *     3D material catalog uses, so swatch == render.
 *   - `slugForMaterialCategory` — `bim_materials` library docs (`bmat_*` ids that
 *     carry no texture prefix) fall back to a per-category slug.
 *
 * `materialThumbnailStore` caches the resolved albedo URL per slug (mirrors
 * `bimMeshThumbnailStore`). It goes through `resolveTextureUrl`, so it works in
 * BOTH public mode (synchronous `/textures/...`) and storage mode (Firebase). The
 * picker subscribes via `use()` / `useMaterialThumbnailUrl` and re-renders once a
 * URL resolves; a missing slug degrades silently to the flat colour chip.
 *
 * Phase-2 ready: a future user-upload override (a `bim_materials.thumbnailUrl`
 * field) can be checked here BEFORE the albedo fallback — every consumer keeps
 * importing only `useMaterialThumbnailUrl`.
 *
 * @see ./material-catalog-defs.ts — prefix resolver + flat colour (no three.js)
 * @see ../../bim-3d/materials/texture-source.ts — public ↔ storage URL resolver
 * @see ../../ui/components/shared/MaterialSwatch.tsx — the consumer component
 * @see docs/centralized-systems/reference/adrs/ADR-413-pbr-textures.md
 */

import { useEffect, useSyncExternalStore } from 'react';
import { textureSlugForKey, type PbrTextureSlug } from './bim-texture-registry';
import { resolveMaterialKey } from './material-catalog-defs';
import { resolveTextureUrl } from '../../bim-3d/materials/texture-source';
import type { BimMaterialCategory } from '../types/bim-material-types';

/**
 * DNA materialId → texture slug, via the SAME resolution the 3D catalog uses
 * (prefix key + registry). `null` when the resolved key has no textured variant.
 */
export function slugForMaterialId(materialId: string): PbrTextureSlug | null {
  return textureSlugForKey(resolveMaterialKey(materialId));
}

/**
 * `bim_materials` library category → closest texture slug, for `bmat_*` docs that
 * carry no DNA prefix. `null` (→ flat colour chip) for categories with no sensible
 * appearance match.
 */
const CATEGORY_SLUG: Record<BimMaterialCategory, PbrTextureSlug | null> = {
  plaster: 'plaster',
  masonry: 'brick',
  concrete: 'concrete',
  insulation: 'plaster',
  flooring: 'tile',
  'window-frame': 'metal',
  'door-frame': 'wood',
  paint: 'plaster',
  roofing: 'roof-tiles',
  waterproofing: 'stone',
  other: null,
};

export function slugForMaterialCategory(category: BimMaterialCategory): PbrTextureSlug | null {
  return CATEGORY_SLUG[category];
}

// ── Albedo-URL-by-slug cache (reactive store, mirrors bimMeshThumbnailStore) ──

const urls = new Map<PbrTextureSlug, string>();
const inFlight = new Set<PbrTextureSlug>();
const listeners = new Set<() => void>();
let version = 0;

function emit(): void {
  version += 1;
  for (const l of listeners) l();
}

/** Resolve one slug's albedo URL (idempotent, fire-and-forget). */
function preloadSlug(slug: PbrTextureSlug): void {
  if (urls.has(slug) || inFlight.has(slug)) return;
  inFlight.add(slug);
  void resolveTextureUrl(slug, 'albedo')
    .then((url) => {
      inFlight.delete(slug);
      if (url) {
        urls.set(slug, url);
        emit();
      }
    })
    .catch(() => {
      // Unresolvable (storage mode error) → leave uncached; chip shows flat colour.
      inFlight.delete(slug);
    });
}

function getSlugUrl(slug: PbrTextureSlug): string | undefined {
  return urls.get(slug);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const materialThumbnailStore = {
  preloadSlug,
  getSlugUrl,
  /** React subscription — returns a version number that bumps on each resolve. */
  use(): number {
    return useSyncExternalStore(subscribe, () => version, () => 0);
  },
};

/**
 * Reactive convenience hook: the resolved albedo URL for a slug (or `null` while
 * unresolved / when `slug` is null). Triggers the preload on mount/slug change.
 */
export function useMaterialThumbnailUrl(slug: PbrTextureSlug | null): string | null {
  materialThumbnailStore.use();
  useEffect(() => {
    if (slug) materialThumbnailStore.preloadSlug(slug);
  }, [slug]);
  return slug ? materialThumbnailStore.getSlugUrl(slug) ?? null : null;
}
