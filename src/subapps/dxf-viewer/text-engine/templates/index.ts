/**
 * ADR-344 Phase 7 — Text Templates barrel.
 *
 * Phase 7.A: types + built-in defaults + placeholder extractor.
 * Phase 7.B (this commit): Firestore doc types + Zod schemas. The CRUD
 *                          service is server-only (`import 'server-only'`)
 *                          and therefore imported directly from
 *                          `./text-template.service` by API routes — never
 *                          via this barrel, which is reachable from client
 *                          bundles.
 * Phase 7.C:                placeholder resolver.
 * Phase 7.D:                management UI.
 * Phase 7.E:                rules emulator test (currently in
 *                          FIRESTORE_RULES_PENDING).
 */

export type {
  TextTemplate,
  TextTemplateCategory,
  TextTemplateLocale,
  BuiltInTextTemplate,
} from './template.types';
export { TextTemplatePlaceholderMismatchError } from './template.types';

export { extractPlaceholders, extractPlaceholdersFromString } from './extract-placeholders';

// Phase 7.B — Firestore boundary types + Zod validators (safe for both client
// and server bundles; the Admin-SDK service itself is NOT re-exported here).
export type {
  UserTextTemplateDoc,
  CreateTextTemplateInput,
  UpdateTextTemplateInput,
  TextTemplateActor,
} from './text-template.types';
export {
  TextTemplateNotFoundError,
  TextTemplateCrossTenantError,
  TextTemplateValidationError,
} from './text-template.types';
export {
  TEXT_TEMPLATE_NAME_MAX,
  createTextTemplateInputSchema,
  updateTextTemplateInputSchema,
  collectIssues,
} from './text-template.zod';

// Phase 7.C — Placeholder resolver (pure) + variable registry + scope types.
// `scope-builder` is NOT re-exported (server-only).
export {
  resolvePlaceholdersInString,
  resolvePlaceholdersInNode,
  resolveTemplate,
  classifyPlaceholders,
  PLACEHOLDER_REGISTRY,
  ALL_PLACEHOLDER_PATHS,
  isKnownPlaceholder,
  getPlaceholderMetadata,
  EMPTY_PLACEHOLDER_SCOPE,
} from './resolver';
export type {
  PlaceholderPath,
  PlaceholderSource,
  PlaceholderMetadata,
  PlaceholderScope,
  PlaceholderScopeCompany,
  PlaceholderScopeProject,
  PlaceholderScopeDrawing,
  PlaceholderScopeUser,
  PlaceholderScopeRevision,
  PlaceholderScopeFormatting,
} from './resolver';

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
