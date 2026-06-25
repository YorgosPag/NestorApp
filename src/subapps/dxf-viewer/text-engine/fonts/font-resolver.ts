/**
 * FontResolver — maps a text entity's font family to a loaded opentype.Font
 * (ADR-530), reusing the existing FontCache + SHX substitution SSoT.
 *
 * Resolution order (Revit/AutoCAD model — "the real font if present, else the
 * closest open substitute"):
 *   1. Direct cache hit on the exact family (e.g. a company-uploaded font).
 *   2. SHX / unknown family → `lookupSubstitute()` catch-all → substitute family
 *      (e.g. romans.shx / arial → "Liberation Sans", txt.shx → "Liberation Mono").
 *
 * Returns `null` when no loaded font matches — the caller then falls back to the
 * CSS `ctx.fillText` path (zero regression). Italic and (un-bundled) bold faces
 * deliberately resolve to `null` so the browser keeps drawing those styles until
 * the corresponding faces are bundled.
 *
 * @module text-engine/fonts/font-resolver
 */

import type { Font } from 'opentype.js';
import { fontCache } from './font-cache';
import { lookupSubstitute } from './font-substitution-table';

export interface FontResolveStyle {
  bold?: boolean;
  italic?: boolean;
}

export interface ResolvedFont {
  font: Font;
  /** The FontCache name the font was found under — used as the glyph-cache key. */
  cacheName: string;
}

/** Resolve a text entity's font family to a loaded glyph font, or null. */
export function resolveEntityFont(
  family: string | undefined,
  style?: FontResolveStyle,
): ResolvedFont | null {
  // Italic faces are not bundled yet → let CSS render italic via fillText.
  if (style?.italic) return null;

  const wantBold = !!style?.bold;
  const name = (family && family.trim()) || 'arial';

  // 1. Direct hit on the exact family (company-uploaded / referenced font).
  if (!wantBold) {
    const direct = fontCache.get(name);
    if (direct) return { font: direct, cacheName: name };
  }

  // 2. Reuse the substitution SSoT (catch-all '*' → Liberation Sans).
  const substitute = lookupSubstitute(name).substituteFamily;
  const target = wantBold && !/bold$/i.test(substitute)
    ? `${substitute} Bold`
    : substitute;
  const subFont = fontCache.get(target);
  if (subFont) return { font: subFont, cacheName: target };

  return null;
}
