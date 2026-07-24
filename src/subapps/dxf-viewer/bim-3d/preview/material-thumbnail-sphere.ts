/**
 * material-thumbnail-sphere — ADR-687 Φ6. ONE lazily-created offscreen sphere
 * renderer that turns a `PbrMaterialDef` into a small PNG data URL, so the material
 * swatches (library list + «Υλικά όψης» bar) show the REAL rendered appearance
 * (green glass, lacquer, metal…) instead of a flat colour chip — the C4D / Revit
 * Material Manager thumbnail.
 *
 * WHY a singleton: browsers cap concurrent WebGL contexts (~16). One shared offscreen
 * renderer draws EVERY material's thumbnail sequentially (render-on-demand); the PMREM
 * studio env is built ONCE in its constructor. The caller (the reactive store) caches
 * the resulting data URL per appearance signature, so each unique appearance renders once.
 *
 * SSoT: reuses `MaterialPreviewSphereRenderer` (the exact editor sphere + studio HDR env
 * + stripe backdrop) with `preserveDrawingBuffer:true` for readback — no second renderer,
 * no second lighting rig (N.18).
 *
 * @see ./material-preview-sphere-renderer.ts — the reused renderer (toDataURL)
 * @see ./material-appearance-thumbnail-store.ts — the reactive cache + hook
 * @see docs/centralized-systems/reference/adrs/ADR-687-material-editor-visual-appearance.md
 */

import type { PbrMaterialDef } from '../../bim/materials/material-catalog-defs';
import type { LoadedTextureSet } from '../materials/bim-texture-cache';
import { MaterialPreviewSphereRenderer } from './material-preview-sphere-renderer';

/** Square render size (px). Downscaled by the swatch (`object-cover`) → crisp at 20–40px. */
const THUMB_SIZE = 64;

let renderer: MaterialPreviewSphereRenderer | null = null;
let unavailable = false; // set once if the GL context can't be created (SSR / no-WebGL / tests)

/** Lazily build (once) the offscreen renderer bound to a detached container. */
function ensureRenderer(): MaterialPreviewSphereRenderer | null {
  if (renderer) return renderer;
  if (unavailable) return null;
  if (typeof document === 'undefined') { unavailable = true; return null; }
  try {
    const container = document.createElement('div');
    // Detached from the DOM — never displayed; sized via `toDataURL`'s resize.
    renderer = new MaterialPreviewSphereRenderer(container, { preserveDrawingBuffer: true });
    return renderer;
  } catch {
    // No WebGL (headless / jsdom / context-limit) → give up permanently; swatch falls back to flat.
    unavailable = true;
    return null;
  }
}

/**
 * Render `def` (optionally WITH a loaded PBR texture set — ADR-687 Φ7) to a PNG data URL,
 * or `null` when offscreen rendering is unavailable (SSR / no-WebGL) or the draw fails.
 * Synchronous (render-on-demand); the caller passes an ALREADY-loaded texture set.
 */
export function renderAppearanceThumbnail(def: PbrMaterialDef, set: LoadedTextureSet | null = null): string | null {
  const r = ensureRenderer();
  if (!r) return null;
  try {
    return r.toDataURL(def, set, THUMB_SIZE);
  } catch {
    return null;
  }
}

/** Test-only — dispose + reset the singleton between specs. */
export function __resetMaterialThumbnailSphereForTests(): void {
  renderer?.dispose();
  renderer = null;
  unavailable = false;
}
