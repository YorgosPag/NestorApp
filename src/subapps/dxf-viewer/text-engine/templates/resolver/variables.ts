/**
 * ADR-344 Phase 7.C — Placeholder variable registry (SSoT).
 *
 * Single source of truth for every `{{namespace.key}}` token the Phase 7.C
 * resolver knows how to substitute. The built-in templates in
 * `defaults/*.ts` may only reference paths declared here; the build-time
 * defaults unit test verifies this invariant.
 *
 * Two contracts:
 *   1. `PlaceholderPath` — string-literal union, type-safe lookup.
 *   2. `PLACEHOLDER_REGISTRY` — metadata table (i18n label key, source
 *      namespace, sample value for the management UI preview).
 *
 * Unknown paths (typos, removed fields) bypass the resolver and remain as
 * literal `{{x.y}}` in the rendered text — by design, per ADR-344 §4 Q5
 * follow-up decision (2026-05-11, Giorgio): the architect must see the
 * broken token to fix it, not a silent empty string.
 */

/** Source namespace — picks which sub-tree of `PlaceholderScope` is read. */
export type PlaceholderSource =
  | 'company'
  | 'project'
  | 'drawing'
  | 'user'
  | 'revision'
  | 'date';

/**
 * Every placeholder path the resolver understands. New paths land here
 * AND in the matching `PlaceholderScope` sub-type AND in the locale files.
 */
export type PlaceholderPath =
  | 'company.name'
  | 'project.name'
  | 'project.code'
  | 'project.owner'
  | 'drawing.title'
  | 'drawing.scale'
  | 'drawing.sheetNumber'
  | 'drawing.units'
  | 'user.fullName'
  | 'user.checkerName'
  | 'user.title'
  | 'user.licenseNumber'
  | 'revision.number'
  | 'revision.date'
  | 'revision.author'
  | 'revision.description'
  | 'date.today';

export interface PlaceholderMetadata {
  /** i18n key under `textTemplates:placeholders.<source>.<key>`. */
  readonly labelI18nKey: string;
  /** Which `PlaceholderScope` sub-tree provides the value. */
  readonly source: PlaceholderSource;
  /** Example value rendered in the management UI preview. */
  readonly sample: string;
}

/**
 * Source of truth for every supported placeholder.
 *
 * Keep alphabetised within each namespace block so diffs stay readable when
 * new tokens are added.
 */
export const PLACEHOLDER_REGISTRY: Readonly<Record<PlaceholderPath, PlaceholderMetadata>> = {
  // ── company ─────────────────────────────────────────────────────────────
  'company.name': {
    labelI18nKey: 'textTemplates:placeholders.company.name',
    source: 'company',
    sample: 'Nestor Construct',
  },
  // ── project ─────────────────────────────────────────────────────────────
  'project.name': {
    labelI18nKey: 'textTemplates:placeholders.project.name',
    source: 'project',
    sample: 'Πολυκατοικία Αθηνών',
  },
  'project.code': {
    labelI18nKey: 'textTemplates:placeholders.project.code',
    source: 'project',
    sample: 'PRJ-001',
  },
  'project.owner': {
    labelI18nKey: 'textTemplates:placeholders.project.owner',
    source: 'project',
    sample: 'Δημήτριος Παπαδόπουλος',
  },
  // ── drawing ─────────────────────────────────────────────────────────────
  'drawing.title': {
    labelI18nKey: 'textTemplates:placeholders.drawing.title',
    source: 'drawing',
    sample: 'Κάτοψη Ισογείου',
  },
  'drawing.scale': {
    labelI18nKey: 'textTemplates:placeholders.drawing.scale',
    source: 'drawing',
    sample: '1:50',
  },
  'drawing.sheetNumber': {
    labelI18nKey: 'textTemplates:placeholders.drawing.sheetNumber',
    source: 'drawing',
    sample: 'A-101',
  },
  'drawing.units': {
    labelI18nKey: 'textTemplates:placeholders.drawing.units',
    source: 'drawing',
    sample: 'mm',
  },
  // ── user ────────────────────────────────────────────────────────────────
  'user.fullName': {
    labelI18nKey: 'textTemplates:placeholders.user.fullName',
    source: 'user',
    sample: 'Γιώργος Παγώνης',
  },
  'user.checkerName': {
    labelI18nKey: 'textTemplates:placeholders.user.checkerName',
    source: 'user',
    sample: 'Νέστωρ Παγώνης',
  },
  'user.title': {
    labelI18nKey: 'textTemplates:placeholders.user.title',
    source: 'user',
    sample: 'Αρχιτέκτων Μηχανικός',
  },
  'user.licenseNumber': {
    labelI18nKey: 'textTemplates:placeholders.user.licenseNumber',
    source: 'user',
    sample: 'ΤΕΕ 12345',
  },
  // ── revision ────────────────────────────────────────────────────────────
  'revision.number': {
    labelI18nKey: 'textTemplates:placeholders.revision.number',
    source: 'revision',
    sample: '3',
  },
  'revision.date': {
    labelI18nKey: 'textTemplates:placeholders.revision.date',
    source: 'revision',
    sample: '11/05/2026',
  },
  'revision.author': {
    labelI18nKey: 'textTemplates:placeholders.revision.author',
    source: 'revision',
    sample: 'Γ. Παγώνης',
  },
  'revision.description': {
    labelI18nKey: 'textTemplates:placeholders.revision.description',
    source: 'revision',
    sample: 'Διόρθωση όψεων',
  },
  // ── date ────────────────────────────────────────────────────────────────
  'date.today': {
    labelI18nKey: 'textTemplates:placeholders.date.today',
    source: 'date',
    sample: '11/05/2026',
  },
};

/** All supported paths, sorted, frozen. */
export const ALL_PLACEHOLDER_PATHS: readonly PlaceholderPath[] = Object.freeze(
  (Object.keys(PLACEHOLDER_REGISTRY) as PlaceholderPath[]).sort(),
);

/** Narrowing predicate — also doubles as runtime registry lookup. */
export function isKnownPlaceholder(path: string): path is PlaceholderPath {
  return Object.prototype.hasOwnProperty.call(PLACEHOLDER_REGISTRY, path);
}

/** Convenience accessor — returns undefined for unknown paths. */
export function getPlaceholderMetadata(path: string): PlaceholderMetadata | undefined {
  return isKnownPlaceholder(path) ? PLACEHOLDER_REGISTRY[path] : undefined;
}
