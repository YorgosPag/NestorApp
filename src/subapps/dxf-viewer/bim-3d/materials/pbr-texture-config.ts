/**
 * Shared PBR texture configuration — ADR-413 (SSoT).
 *
 * The ONE place that configures a freshly-loaded `THREE.Texture` for physical
 * tiling: RepeatWrapping + `repeat = 1 / tileSizeM` (geometry UVs are authored in
 * world meters, so the tile spans `tileSizeM` metres regardless of mesh size) +
 * anisotropy + colour space (albedo = sRGB, data maps = linear).
 *
 * Used by BOTH the slug-based shared library cache (`bim-texture-cache.ts`) and
 * the per-material user registry (`user-material-registry.ts`) so the two texture
 * pipelines configure identically (Revit-grade consistency, zero duplication).
 *
 * @see ./bim-texture-cache.ts — shared CC0 slug library
 * @see ./user-material-registry.ts — per-material user uploads
 * @see docs/centralized-systems/reference/adrs/ADR-413-pbr-textures-parametric-bim.md
 */

import * as THREE from 'three';

/** Anisotropic filtering level for all BIM PBR textures (sharper at grazing angles). */
export const PBR_TEXTURE_ANISOTROPY = 8;

/**
 * Configure a freshly-loaded texture for physical-metre tiling.
 *
 * @param tex        the loaded texture (mutated in place)
 * @param tileSizeM  real-world repeat size of one tile, in METERS
 * @param isAlbedo   true for the base-colour map (sRGB); false for data maps
 */
export function configurePbrTexture(tex: THREE.Texture, tileSizeM: number, isAlbedo: boolean): void {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  const repeat = 1 / tileSizeM;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = PBR_TEXTURE_ANISOTROPY;
  // Albedo carries colour → sRGB; data maps (normal/roughness/ao) stay linear.
  tex.colorSpace = isAlbedo ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
}
