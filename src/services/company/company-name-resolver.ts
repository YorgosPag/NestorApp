/**
 * =============================================================================
 * 🏢 COMPANY NAME RESOLVER — SSoT (ADR-312 Phase 3.6)
 * =============================================================================
 *
 * Single source of truth for company display-name resolution across:
 *  - `companies` tenant docs        (field: `name`)
 *  - `contacts` company docs        (fields: `companyName`, `tradeName`, `legalName`)
 *  - Project / navigation bootstrap (field: `displayName`)
 *
 * Replaces 6 hardcoded `'Unknown Company'` literals that each read a different
 * subset of fields. Callers now pass every known field; the resolver picks
 * the best non-empty one in a fixed priority order. Fallback is an
 * identifier-based label (`Company #<idPrefix>`), never a translatable literal,
 * so it is safe to persist in Firestore or emit from server logs.
 *
 * UI callers that need a translated fallback can pass `config.fallback` with
 * `t('common.company.unnamed')` or any i18n-resolved string.
 *
 * @module services/company/company-name-resolver
 */

const DEFAULT_FALLBACK_PREFIX = 'Company';
const DEFAULT_ID_SLICE = 8;

export interface CompanyNameInput {
  /** Firestore doc ID (used to build identifier fallback). */
  id?: string;
  /** `companies` collection — tenant display name. */
  name?: string;
  /** `contacts` collection (type=company) — primary company name. */
  companyName?: string;
  /** `contacts` collection — trade/commercial name (διακριτικός τίτλος). */
  tradeName?: string;
  /** `contacts` collection — legal/registered name. */
  legalName?: string;
  /** Generic fallback used in bootstrap snapshots. */
  displayName?: string;
}

export type CompanyNameSource =
  | 'name'
  | 'companyName'
  | 'tradeName'
  | 'legalName'
  | 'displayName'
  | 'fallback';

export interface CompanyNameResult {
  /** Resolved display name (always a non-empty string). */
  displayName: string;
  /** Which field produced the display name, or `'fallback'`. */
  source: CompanyNameSource;
  /** `false` when `source === 'fallback'` (no real name was available). */
  hasRealName: boolean;
}

export interface CompanyNameConfig {
  /**
   * Explicit fallback string used when no name field is populated.
   * Prefer an i18n-resolved string for UI; omit for server/logging contexts
   * (an identifier-based fallback is generated from `input.id`).
   */
  fallback?: string;
  /** Truncate long names to this length (adds `...`). */
  maxLength?: number;
}

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function truncate(value: string, maxLength?: number): string {
  if (!maxLength || value.length <= maxLength) return value;
  return value.slice(0, maxLength - 3) + '...';
}

function buildIdentifierFallback(id?: string): string {
  const idPart = id ? id.slice(0, DEFAULT_ID_SLICE) : 'unknown';
  return `${DEFAULT_FALLBACK_PREFIX} #${idPart}`;
}

const PRIORITY: Array<Exclude<CompanyNameSource, 'fallback'>> = [
  'name',
  'companyName',
  'tradeName',
  'legalName',
  'displayName',
];

/**
 * Resolve a company display name with source attribution.
 *
 * Priority: `name` → `companyName` → `tradeName` → `legalName` → `displayName`
 * → `config.fallback` → identifier-based (`Company #<idPrefix>`).
 */
export function resolveCompanyName(
  input: CompanyNameInput,
  config: CompanyNameConfig = {},
): CompanyNameResult {
  for (const source of PRIORITY) {
    const raw = input[source];
    if (isNonEmpty(raw)) {
      return {
        displayName: truncate(raw.trim(), config.maxLength),
        source,
        hasRealName: true,
      };
    }
  }

  const fallback = isNonEmpty(config.fallback)
    ? config.fallback.trim()
    : buildIdentifierFallback(input.id);

  return {
    displayName: truncate(fallback, config.maxLength),
    source: 'fallback',
    hasRealName: false,
  };
}

/** Convenience: return only the resolved display name string. */
export function resolveCompanyDisplayName(
  input: CompanyNameInput,
  config?: CompanyNameConfig,
): string {
  return resolveCompanyName(input, config).displayName;
}
