/**
 * Audit Value Catalogs — SSoT for audit-trail enum translation
 *
 * Maps audit-tracked fields (from CONTACT_TRACKED_FIELDS / PROPERTY_TRACKED_FIELDS)
 * to the canonical i18n catalog that contains their enum value labels.
 *
 * Why this module exists
 * ----------------------
 * Audit-trail entries persist raw enum keys to Firestore (e.g. `category: "region"`).
 * When the audit timeline renders, those raw keys must be translated to human-readable
 * labels. Historically the renderer duplicated every enum value under `common:audit.values.*`,
 * which drifted whenever a new value was added to the form option catalogs. On 2026-04-11
 * the `serviceCategories` catalog grew 19 entries while `audit.values` held only 2,
 * so the audit trail displayed raw keys (`region`, `publicEntity`, ...).
 *
 * Solution: single source of truth. Each audit-tracked field points at its canonical
 * catalog namespace/path. The runtime resolver performs the lookup there first, and the
 * pre-commit CHECK 3.13 validator enforces that every referenced catalog exists and is
 * in parity across `el` and `en` locales.
 *
 * @module config/audit-value-catalogs
 * @enterprise ADR-195 — Entity Audit Trail | ADR-279 — Google-Grade i18n Governance
 */

/**
 * Reference to an i18n catalog: a namespace + dot-path pointing to an object
 * whose keys are enum values and whose string values are their human labels.
 */
export interface AuditCatalogRef {
  /** i18next namespace (locale file name without extension). */
  readonly ns: string;
  /** Dot-path inside the namespace JSON to the enum catalog object. */
  readonly path: string;
}

/**
 * Audit-tracked field → canonical enum catalog.
 *
 * RULES
 * -----
 *  - Only include fields whose stored values are enum keys (not free text).
 *  - The referenced path MUST resolve to an object of string values in every locale.
 *  - Do NOT duplicate entries in `common:audit.values.*` — this map IS the source.
 *  - When you add a new tracked enum field, add it here AND run
 *    `npm run audit-values:audit` locally. The pre-commit hook (CHECK 3.13) blocks
 *    commits that reference a missing or mismatched catalog.
 */
export const AUDIT_VALUE_CATALOGS: Readonly<Record<string, AuditCatalogRef>> = {
  // ── Contact: service category (ministry/region/municipality/...)
  category: { ns: 'contacts-form', path: 'options.serviceCategories' },

  // ── Contact: service legal status (npdd/npid/...)
  legalStatus: { ns: 'contacts-form', path: 'options.legalStatuses' },

  // ── Contact: individual gender (male/female/other/preferNotToSay)
  gender: { ns: 'contacts-form', path: 'options.gender' },

  // ── Contact: individual document type (identityCard/passport/...)
  documentType: { ns: 'contacts-form', path: 'options.identity' },
} as const;

/** All field names that have a registered catalog — cheap membership test. */
export const AUDIT_CATALOG_FIELDS: ReadonlySet<string> = new Set(
  Object.keys(AUDIT_VALUE_CATALOGS),
);

/** Type-safe lookup. Returns `undefined` for fields without a registered catalog. */
export function getAuditValueCatalog(field: string): AuditCatalogRef | undefined {
  return AUDIT_VALUE_CATALOGS[field];
}
