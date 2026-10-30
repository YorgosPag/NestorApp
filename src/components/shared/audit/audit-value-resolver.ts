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
 *   1. **Canonical catalog (direct)** — the catalog the field's descriptor declares
 *      for this entity (`TrackedFieldDef.enumCatalog`), else the one registered under
 *      the field name. Try `{ns}:{path}.{value}`. Hit → return translation.
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

import { getAuditValueCatalog, type AuditCatalogRef } from '@/config/audit-value-catalogs';
import { calendarDateOfDateKey } from '@/lib/calendar/date-key';
import { formatDate } from '@/lib/intl-utils';

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
 * catalogs (e.g. `VOCAB_SERVICE_CATEGORIES`) use snake_case tokens
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

/**
 * Result of a catalog lookup.
 *
 * 🔑 **Οντότητα+πεδίο πρώτα, όνομα πεδίου μετά** — η ίδια προτεραιότητα με την ετικέτα και την
 * ποσότητα (ADR-852). Ο `declared` είναι ο κατάλογος του περιγραφέα (`TrackedFieldDef.enumCatalog`):
 * υπάρχει επειδή ένα όνομα πεδίου (`kind`) ανήκει σε πολλές οντότητες με **άλλο** λεξιλόγιο, και ο
 * χάρτης ανά όνομα δεν μπορεί να τις ξεχωρίσει.
 */
function lookupInCatalog(
  catalog: AuditCatalogRef | undefined,
  value: string,
  t: AuditTranslator,
): string | undefined {
  if (!catalog) return undefined;

  const opts = { ns: catalog.ns };
  value = canonicalCatalogValue(catalog, value);
  const camel = toCamelCase(value);

  for (const path of [catalog.path, ...(catalog.fallbackPaths ?? [])]) {
    const direct = tryTranslate(`${path}.${value}`, opts, t);
    if (direct) return direct;

    if (camel !== value) {
      const normalized = tryTranslate(`${path}.${camel}`, opts, t);
      if (normalized) return normalized;
    }
  }

  return undefined;
}

/** Παλιά ορθογραφία → τιμή του καταλόγου (`valueAliases`· μόνο own-property, ώστε `constructor` κ.λπ. να μη «λύνονται»). */
function canonicalCatalogValue(catalog: AuditCatalogRef, value: string): string {
  const aliases = catalog.valueAliases;
  return aliases && Object.prototype.hasOwnProperty.call(aliases, value) ? aliases[value] : value;
}

/** Legacy fallback: `common:audit.values.{value}`. */
function lookupInAuditValues(value: string, t: AuditTranslator): string | undefined {
  const key = `audit.values.${value}`;
  const opts = { ns: 'common' };
  if (!i18next.exists(key, opts)) return undefined;

  const translated = t(key, opts);
  return translated && translated !== key ? translated : undefined;
}

/**
 * ISO-8601 date → η ημερομηνία στη γλώσσα **του θεατή** (ADR-195 (ζ): ήταν καρφωμένο `el-GR`, άρα ο Άγγλος έβλεπε
 * ελληνική μορφή). Σκέτη ημέρα `YYYY-MM-DD` ⇒ η **ίδια** τοπική ημέρα (`calendarDateOfDateKey`): το `new Date(key)`
 * είναι μεσάνυχτα UTC, δηλαδή η **προηγούμενη** ημέρα για θεατή δυτικά του Greenwich.
 */
function formatIsoDate(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return undefined;
  const date = calendarDateOfDateKey(value) ?? new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return formatDate(date);
}

/**
 * Resolve an audit value to a human-readable label.
 *
 * @param field - The tracked field name (e.g. `category`, `gender`).
 * @param value - The raw value stored in the audit entry (enum key, date, ...).
 * @param t     - i18next translator bound to the caller's default namespace.
 * @param catalog - The catalog declared by the field's descriptor for **this entity**
 *          (`TrackedFieldDef.enumCatalog`). Wins over the field-name catalog; omit it and
 *          the lookup is by field name alone.
 * @returns A translated string, or `undefined` if no rule matched (caller should
 *          render the raw value so the failure is visible).
 */
export function resolveAuditValue(
  field: string,
  value: string,
  t: AuditTranslator,
  catalog?: AuditCatalogRef,
): string | undefined {
  return resolveWithCatalog(catalog ?? getAuditValueCatalog(field), value, t);
}

/**
 * ADR-195 (ζ) — η τιμή **υπο-πεδίου** ρωτά ΜΟΝΟ τον κατάλογο που δηλώνει η συλλογή της (`itemCatalogs`), **ποτέ** τον
 * κατάλογο του ονόματος: ο χάρτης ανά όνομα περιγράφει πεδία **πρώτου** επιπέδου, και το `phones[].type` περνούσε από
 * τον κατάλογο του `type` — τους τύπους **ακινήτου**. Αδήλωτο υπο-πεδίο ⇒ γενική πτώση ⇒ ωμή τιμή, **ορατά**.
 */
export function resolveDeclaredAuditValue(
  catalog: AuditCatalogRef | undefined,
  value: string,
  t: AuditTranslator,
): string | undefined {
  return resolveWithCatalog(catalog, value, t);
}

/** Η λέξη μιας τιμής **μόνο** από τον κατάλογο — χωρίς πτώσεις (ο μορφοποιητής δείχνει την τιμή όταν λείπει). */
export function translateCatalogValue(
  catalog: AuditCatalogRef | undefined,
  value: string,
  t: AuditTranslator,
): string | undefined {
  return lookupInCatalog(catalog, value, t);
}

/** Η σειρά επίλυσης της κεφαλίδας του αρχείου, για ήδη επιλεγμένο κατάλογο. */
function resolveWithCatalog(
  catalog: AuditCatalogRef | undefined,
  value: string,
  t: AuditTranslator,
): string | undefined {
  const direct = lookupInCatalog(catalog, value, t);
  if (direct) return direct;

  if (value.includes(' — ')) {
    const [head, ...rest] = value.split(' — ');
    const translatedHead =
      lookupInCatalog(catalog, head, t) ?? lookupInAuditValues(head, t);
    if (translatedHead) return `${translatedHead} — ${rest.join(' — ')}`;
  }

  const legacy = lookupInAuditValues(value, t);
  if (legacy) return legacy;

  return formatIsoDate(value);
}
