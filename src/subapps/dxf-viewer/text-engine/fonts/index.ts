export { FONT_SUBSTITUTION_TABLE, lookupSubstitute } from './font-substitution-table';
export type { FontSubstitutionEntry } from './font-substitution-table';

export { FontCache, fontCache } from './font-cache';

export {
  loadFont,
  loadFontFromBuffer,
  loadCompanyFont,
  buildMissingFontReport,
  listCompanyFontsMeta,
} from './font-loader';
export type { MissingFontReport, CompanyFontMeta } from './font-loader';

export { glyphToPath2D, stringToPath2D, measureText } from './glyph-renderer';
export type { TextMetrics } from './glyph-renderer';

// ADR-530 — main-canvas glyph rendering wiring.
export { resolveEntityFont } from './font-resolver';
export type { ResolvedFont, FontResolveStyle } from './font-resolver';
export { getGlyphRun, clearGlyphPathCache, GLYPH_REFERENCE_SIZE } from './glyph-path-cache';
export type { GlyphRun } from './glyph-path-cache';

// ADR-557 Φάση C — the ONE single-line text-run paint SSoT, shared by the 2D renderer AND
// the 3D textured-plane converter, so a glyph draws with the SAME outlines/tracking/fallback
// in every viewport (no second `ctx.fillText` mechanism in 3D).
export { drawGlyphRunToCanvas, paintTextRun, measureTextRunPx } from './glyph-run-draw';
export type { PaintTextRunOptions } from './glyph-run-draw';

// ADR-557 Φ-attachment — metrics-accurate text advance SSoT (real glyph width in
// world units), shared by the text-box geometry so grips/hover/hitTest ≡ drawn glyphs.
export { measureTextAdvanceWorld, __resetTextAdvanceMeasureCtx } from './text-advance';
export type { TextAdvanceStyle } from './text-advance';

// ADR-557 Φ-attachment — glyph INK box (both axes): real font-metric baseline anchor +
// glyph ink extent + side bearings (world-ratio), so the VISUAL box ≡ the drawn glyphs.
export { measureTextGlyphInk } from './text-vertical-metrics';
export type { TextGlyphInk, TextGlyphInkStyle } from './text-vertical-metrics';
export { subscribeFontReady, bumpFontReady, getFontReadyVersion } from './font-ready-store';
export { preloadCadSubstituteFonts, CAD_SUBSTITUTE_FONTS } from './cad-font-preload';
export type { CadSubstituteFont } from './cad-font-preload';

export {
  subscribeMissingFontReport,
  getMissingFontReport,
  setMissingFontReport,
  clearMissingFontReport,
} from './missing-font-store';

export {
  uploadCompanyFont,
  deleteCompanyFont,
  listCompanyFonts,
  getCompanyFontUrl,
} from './font-manager';
export type { CompanyFontRecord, FontFormat } from './font-manager';
