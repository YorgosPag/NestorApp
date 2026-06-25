/**
 * CadFontPreload — loads the bundled open-license substitute font(s) into the
 * FontCache so the main canvas can render text as glyph paths (ADR-530).
 *
 * `cacheName` is the LOGICAL substitute family the font backs (must match the
 * targets in `FONT_SUBSTITUTION_TABLE`); `url` is the PHYSICAL file under
 * `public/fonts/`. This indirection lets the proof-of-concept stand Roboto
 * (Apache 2.0, already bundled) in for "Liberation Sans": when the real
 * Liberation TTFs (SIL OFL 1.1) are dropped into `public/fonts/`, only the `url`
 * changes — the resolver/substitution wiring stays identical.
 *
 * @module text-engine/fonts/cad-font-preload
 */

import { loadFont } from './font-loader';
import { fontCache } from './font-cache';
import { bumpFontReady } from './font-ready-store';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CadFontPreload');

export interface CadSubstituteFont {
  /** Logical substitute family (matches FONT_SUBSTITUTION_TABLE targets). */
  readonly cacheName: string;
  /** Physical font file served from public/fonts/. */
  readonly url: string;
}

/**
 * The substitute fonts the main canvas renders with.
 *
 * POC: Roboto-Regular stands in for "Liberation Sans". Swap the `url` to
 * `/fonts/LiberationSans-Regular.ttf` (+ add Mono / Bold rows) once the OFL
 * Liberation files are bundled.
 */
export const CAD_SUBSTITUTE_FONTS: readonly CadSubstituteFont[] = [
  { cacheName: 'Liberation Sans', url: '/fonts/Roboto-Regular.ttf' },
];

let started = false;

/**
 * Idempotent preload — fetches each substitute font once and signals
 * `bumpFontReady()` when at least one is available so the canvas can rebuild
 * its bitmap cache with glyph text. Safe to call on every canvas mount.
 */
export async function preloadCadSubstituteFonts(): Promise<void> {
  if (started) return;
  started = true;

  let loadedAny = false;
  for (const entry of CAD_SUBSTITUTE_FONTS) {
    if (fontCache.has(entry.cacheName)) {
      loadedAny = true;
      continue;
    }
    try {
      await loadFont(entry.url, entry.cacheName);
      loadedAny = true;
    } catch (error) {
      logger.warn('CAD substitute font failed to load', { url: entry.url, error });
    }
  }

  if (loadedAny) bumpFontReady();
}
