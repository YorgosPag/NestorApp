/**
 * Property enum label resolver — server-side SSoT.
 *
 * Maps raw property enum keys (stored in Firestore as `apartment`, `north`,
 * `new`, ...) to human-readable locale labels (`Διαμέρισμα`, `Βόρειο`,
 * `Νέο`, ...). Reads from the same `properties-enums.json` catalogs used by
 * the client-side `useTranslation('properties-enums')` hook so the web page
 * and the server-generated PDF always display identical text.
 *
 * Why a separate service
 * ----------------------
 * The public `/api/showcase/[token]` resolver and the PDF generator both run
 * server-side and must translate these enums before returning/rendering.
 * Duplicating the lookup inline would drift. This module is the single entry
 * point — future consumers (reports, emails, ...) should import from here
 * rather than re-implementing.
 *
 * @module services/property-enum-labels/property-enum-labels.service
 * @enterprise ADR-312 (Phase 3.5)
 */

import elEnums from '@/i18n/locales/el/properties-enums.json';
import enEnums from '@/i18n/locales/en/properties-enums.json';

export type EnumLocale = 'el' | 'en';

type EnumCatalog = typeof elEnums;

const CATALOGS: Record<EnumLocale, EnumCatalog> = {
  el: elEnums as EnumCatalog,
  en: enEnums as unknown as EnumCatalog,
};

function asMap(value: unknown): Record<string, string> {
  return (value ?? {}) as Record<string, string>;
}

export function translatePropertyType(
  key: string | undefined,
  locale: EnumLocale = 'el'
): string | undefined {
  if (!key) return undefined;
  const catalog = CATALOGS[locale];
  const auditTypes = asMap((catalog as { auditTypes?: unknown }).auditTypes);
  const types = asMap((catalog as { types?: unknown }).types);
  return auditTypes[key] || types[key] || key;
}

export function translateOrientations(
  keys: readonly string[] | undefined,
  locale: EnumLocale = 'el'
): string[] | undefined {
  if (!keys || keys.length === 0) return undefined;
  const catalog = CATALOGS[locale];
  const units = (catalog as { units?: { orientation?: unknown } }).units;
  const map = asMap(units?.orientation);
  return keys.map((k) => map[k] || k);
}

export function translatePropertyCondition(
  key: string | undefined,
  locale: EnumLocale = 'el'
): string | undefined {
  if (!key) return undefined;
  const catalog = CATALOGS[locale];
  const condition = asMap((catalog as { condition?: unknown }).condition);
  return condition[key] || key;
}
