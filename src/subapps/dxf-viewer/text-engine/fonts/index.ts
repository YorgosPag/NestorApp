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
