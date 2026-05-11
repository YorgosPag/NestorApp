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
