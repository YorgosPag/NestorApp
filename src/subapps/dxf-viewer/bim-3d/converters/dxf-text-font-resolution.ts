/**
 * dxf-text-font-resolution.ts — resolve a DXF text entity's glyph font + style, exactly like
 * the 2D `TextRenderer` (ADR-557 Φάση C). THE single font-resolution SSoT the 3D text path uses,
 * shared by BOTH the shared glyph atlas (`glyph-atlas.ts`, ADR-645 Φάση B) and any single-mesh
 * fallback. Pure — no THREE / React / DOM at module load (the CSS `buildUIFont` string is lazy).
 *
 * Before this module the resolution lived inline in `dxf-text-3d.ts`; extracting it lets the atlas
 * rasterizer reuse the EXACT same font/tracking/widthFactor resolution (no second, divergent glyph
 * mechanism — the ADR-557 parity contract) without importing THREE.
 */

import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
import { TEXT_FONTS, buildUIFont } from '../../config/text-rendering-config';
// ADR-557 Φάση C — the shared glyph font resolver (loaded CAD font, else CSS `ctx.fillText`).
import { resolveEntityFont, type ResolvedFont } from '../../text-engine/fonts';

/** Resolved glyph style for the 3D text, mirroring the 2D renderer's font resolution. */
export interface TextFontResolution {
  /** A loaded opentype font, or null → CSS `ctx.fillText` fallback (`fallbackFont`). */
  readonly resolved: ResolvedFont | null;
  /** AutoCAD `\T` tracking factor (1 = normal). */
  readonly tracking: number;
  /** AutoCAD TEXT X-scale (horizontal stretch, 1 = none). */
  readonly widthFactor: number;
  /** CSS font string for the fallback path, at a given px size (family/bold/italic honoured). */
  readonly fallbackFont: (px: number) => string;
  /** A stable identity of the resolved face — the atlas cell-cache key prefix (per font+style). */
  readonly faceKey: string;
}

/**
 * Resolve the glyph font + style once, exactly like the 2D `TextRenderer`: a loaded CAD font
 * via `resolveEntityFont` (bold direct, italic → null → CSS), plus the tracking / widthFactor /
 * fallback-CSS-font the shared paint SSoT needs. So the 3D atlas honours the SAME style as 2D.
 */
export function resolveTextFont(entity: DxfText): TextFontResolution {
  const style = entity.textStyle;
  const family = style?.fontFamily || TEXT_FONTS.DEFAULT_FAMILY;
  const weight: 'normal' | 'bold' = style?.bold ? 'bold' : 'normal';
  const italic = !!style?.italic;
  const resolved = resolveEntityFont(style?.fontFamily, { bold: style?.bold, italic: style?.italic });
  // The face identity: the loaded font's cache name when a CAD font resolved, else the CSS face
  // signature (family + weight + italic). Two texts sharing it share atlas cells for the same char.
  const faceKey = resolved ? `f:${resolved.cacheName}` : `c:${family}|${weight}|${italic ? 'i' : 'n'}`;
  return {
    resolved,
    tracking: typeof style?.tracking === 'number' && style.tracking > 0 ? style.tracking : 1,
    widthFactor: typeof entity.widthFactor === 'number' && entity.widthFactor > 0 ? entity.widthFactor : 1,
    fallbackFont: (px: number) => buildUIFont(px, family, weight, italic),
    faceKey,
  };
}
