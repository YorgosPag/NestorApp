/**
 * ADR-344 Phase 7.A — Text template types.
 *
 * A TextTemplate is a reusable DxfTextNode (title block, stamp, revision
 * table, etc.) that the architect can drop into a drawing. The template's
 * `content` carries placeholder tokens of the form `{{namespace.key}}`
 * (e.g. `{{project.name}}`, `{{date.today}}`); the Phase 7.C resolver
 * substitutes real values at insertion time.
 *
 * Two storage tiers (Path C hybrid per Q5):
 *   1. Built-in defaults  — shipped as TypeScript constants in
 *      `defaults/`, immutable, `companyId: null`, `isDefault: true`.
 *   2. User templates     — stored in Firestore `text_templates`
 *      (companyId-scoped per ADR-326), full CRUD via Phase 7.B.
 *
 * The same `TextTemplate` shape covers both tiers so the management UI
 * (Phase 7.D) and the insertion command (later) treat them uniformly.
 */

import type { DxfTextNode } from '../types/text-ast.types';

/** Functional grouping for the management UI grid. */
export type TextTemplateCategory =
  | 'title-block'
  | 'stamp'
  | 'revision'
  | 'notes'
  | 'scale-bar'
  | 'custom';

/**
 * Locale tag for built-in templates. User templates leave this undefined.
 * The UI uses it to show flag chips and to auto-select on first insertion.
 */
export type TextTemplateLocale = 'el' | 'en' | 'multi';

/**
 * Canonical template document — same shape for built-ins and Firestore docs.
 *
 * Built-ins: `companyId` is null, `isDefault` is true, timestamps are null,
 * `id` follows the `builtin/<slug>` convention (never an enterprise ID).
 *
 * User: `companyId` is the tenant, `isDefault` is false, timestamps populated
 * by Firestore, `id` from `generateTextTemplateId()` (prefix `tpl_text`).
 */
export interface TextTemplate {
  /** Stable identifier — `builtin/<slug>` for defaults, enterprise ID for user docs. */
  readonly id: string;
  /** Tenant scope. Null = built-in default available to all tenants. */
  readonly companyId: string | null;
  /** Display name shown in the management UI. i18n key for built-ins. */
  readonly name: string;
  /** i18n key for the localised display name (built-ins). User templates leave empty. */
  readonly nameI18nKey?: string;
  readonly category: TextTemplateCategory;
  /** The DxfTextNode that gets inserted. May contain `{{...}}` placeholder runs. */
  readonly content: DxfTextNode;
  /** Placeholder paths extracted from `content` at build time. Sorted, unique. */
  readonly placeholders: readonly string[];
  /** True for built-in defaults. UI marks these as read-only. */
  readonly isDefault: boolean;
  /** Built-in locale tag. Absent for user templates. */
  readonly locale?: TextTemplateLocale;
  readonly createdAt: Date | null;
  readonly updatedAt: Date | null;
}

/**
 * Built-in template variant — narrower view used by the defaults registry.
 * Carries no Firestore-specific fields and never has timestamps.
 */
export interface BuiltInTextTemplate extends TextTemplate {
  readonly companyId: null;
  readonly isDefault: true;
  readonly createdAt: null;
  readonly updatedAt: null;
  readonly nameI18nKey: string;
  readonly locale: TextTemplateLocale;
}

/**
 * Build-time validation: assert that every placeholder in `content`
 * appears in `placeholders` and vice versa. Thrown via the unit tests
 * in `__tests__/defaults.test.ts`, never at runtime in production.
 */
export class TextTemplatePlaceholderMismatchError extends Error {
  constructor(templateId: string, scanned: readonly string[], declared: readonly string[]) {
    super(
      `Template "${templateId}": placeholder mismatch — scanned [${scanned.join(', ')}] vs declared [${declared.join(', ')}]`,
    );
    this.name = 'TextTemplatePlaceholderMismatchError';
  }
}
