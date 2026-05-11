/**
 * ADR-344 Phase 7 — Text Templates barrel.
 *
 * Phase 7.A (this commit): types + built-in defaults + placeholder extractor.
 * Phase 7.B (next):         Firestore CRUD service.
 * Phase 7.C:                placeholder resolver.
 * Phase 7.D:                management UI.
 */

export type {
  TextTemplate,
  TextTemplateCategory,
  TextTemplateLocale,
  BuiltInTextTemplate,
} from './template.types';
export { TextTemplatePlaceholderMismatchError } from './template.types';

export { extractPlaceholders, extractPlaceholdersFromString } from './extract-placeholders';

export {
  BUILT_IN_TEXT_TEMPLATES,
  BUILT_IN_TEXT_TEMPLATES_BY_ID,
  BUILT_IN_TEXT_TEMPLATES_BY_CATEGORY,
  TITLE_BLOCK_EL,
  TITLE_BLOCK_EN,
  TITLE_BLOCK_DEFAULTS,
  SIGNOFF_STAMP_EL,
  SIGNOFF_STAMP_EN,
  APPROVAL_STAMP_EL,
  STAMP_DEFAULTS,
  GENERAL_NOTES_EL,
  GENERAL_NOTES_EN,
  NOTES_DEFAULTS,
  REVISION_TABLE_EL,
  REVISION_TABLE_EN,
  REVISION_DEFAULTS,
  SCALE_BAR_MULTI,
  SCALE_BAR_DEFAULTS,
} from './defaults';
