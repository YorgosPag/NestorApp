/**
 * Audit Value Resolver — SSoT-aware translator for audit-trail enum values
 *
 * Replaces the prior ad-hoc `t('audit.values.${v}')` lookup that required every
 * enum value to be duplicated under `common:audit.values.*`. This resolver reads
 * the canonical catalog for the current field from {@link AUDIT_VALUE_CATALOGS}
 * and looks the value up there first. Fallbacks preserve legacy behaviour and
 * handle values without a registered catalog (e.g. date strings).
 *
 * Resolution order
 * ----------------
 *   1. **Canonical catalog (direct)** — if the field has a registered catalog,
 *      try `{ns}:{path}.{value}`. Hit → return translation.
 *   2. **Canonical catalog (snake→camel)** — if the stored value contains
 *      `_` or `-`, retry with a camelCase normalization (e.g. `fire_department`
 *      → `fireDepartment`). Required because form option values persist as
 *      snake_case while ADR-279 mandates camelCase catalog keys.
 *   3. **Legacy composite** ("key — label") — translate the first segment via
 *      the same strategy (catalog then audit.values).
 *   4. **Generic fallback** — `common:audit.values.{value}`. Covers fields
 *      without a catalog (status, gender when not registered, etc.).
 *   5. **ISO-8601 date** — localised date string.
 *   6. **undefined** — caller must render the raw value.
 *
 * @module components/shared/audit/audit-value-resolver
 * @enterprise ADR-195 — Entity Audit Trail | ADR-279 — Google-Grade i18n Governance
 */

import i18next from 'i18next';

import { getAuditValueCatalog } from '@/config/audit-value-catalogs';

/**
 * Minimal subset of the react-i18next `t` function signature used here.
 * Kept intentionally narrow so unit tests can pass a plain function.
 */
export type AuditTranslator = (
  key: string,
  options?: Record<string, unknown>,
) => string;

/**
 * Convert a snake_case / kebab-case token to camelCase.
 *
 * Audit trail entries persist form option values as stored — most form
 * catalogs (e.g. `MODAL_SELECT_SERVICE_CATEGORIES`) use snake_case tokens
 * like `fire_department`, while the canonical i18n catalogs referenced by
 * `AUDIT_VALUE_CATALOGS` normalize enum keys to camelCase (`fireDepartment`)
 * per ADR-279. Without this normalization the audit timeline silently
 * renders raw snake_case tokens (2026-04-11 regression).
 *
 * The pre-commit CHECK 3.14 guarantees referenced catalogs only contain
 * camelCase keys, so this one-way conversion is always safe.
 */
function toCamelCase(value: string): string {
  return value.replace(/[_-]([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Attempt a single `t()` lookup. Returns the translation if the key exists
 * and i18next actually resolved it (not an echo of the key itself).
 */
function tryTranslate(
  key: string,
  opts: { ns: string },
  t: AuditTranslator,
): string | undefined {
  if (!i18next.exists(key, opts)) return undefined;
  const translated = t(key, opts);
  return translated && translated !== key ? translated : undefined;
}

/** Result of a catalog lookup. */
function lookupInCatalog(
  field: string,
  value: string,
  t: AuditTranslator,
): string | undefined {
  const catalog = getAuditValueCatalog(field);
  if (!catalog) return undefined;

  const opts = { ns: catalog.ns };

  const direct = tryTranslate(`${catalog.path}.${value}`, opts, t);
  if (direct) return direct;

  const camel = toCamelCase(value);
  if (camel !== value) {
    const normalized = tryTranslate(`${catalog.path}.${camel}`, opts, t);
    if (normalized) return normalized;
  }

  return undefined;
}

/** Legacy fallback: `common:audit.values.{value}`. */
function lookupInAuditValues(value: string, t: AuditTranslator): string | undefined {
  const key = `audit.values.${value}`;
  const opts = { ns: 'common' };
  if (!i18next.exists(key, opts)) return undefined;

  const translated = t(key, opts);
  return translated && translated !== key ? translated : undefined;
}

/** ISO-8601 date → localised display string. */
function formatIsoDate(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Resolve an audit value to a human-readable label.
 *
 * @param field - The tracked field name (e.g. `category`, `gender`).
 * @param value - The raw value stored in the audit entry (enum key, date, ...).
 * @param t     - i18next translator bound to the caller's default namespace.
 * @returns A translated string, or `undefined` if no rule matched (caller should
 *          render the raw value so the failure is visible).
 */
export function resolveAuditValue(
  field: string,
  value: string,
  t: AuditTranslator,
): string | undefined {
  const direct = lookupInCatalog(field, value, t);
  if (direct) return direct;

  if (value.includes(' — ')) {
    const [head, ...rest] = value.split(' — ');
    const translatedHead = lookupInCatalog(field, head, t) ?? lookupInAuditValues(head, t);
    if (translatedHead) return `${translatedHead} — ${rest.join(' — ')}`;
  }

  const legacy = lookupInAuditValues(value, t);
  if (legacy) return legacy;

  return formatIsoDate(value);
}
