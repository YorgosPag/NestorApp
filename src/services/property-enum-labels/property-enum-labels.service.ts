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
 * @enterprise ADR-312 (Phase 3.5 + Phase 4 full-field extension)
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

function lookup(
  locale: EnumLocale,
  path: readonly string[],
  key: string | undefined,
): string | undefined {
  if (!key) return undefined;
  let node: unknown = CATALOGS[locale];
  for (const segment of path) {
    if (node === null || typeof node !== 'object') return key;
    node = (node as Record<string, unknown>)[segment];
  }
  const map = asMap(node);
  return map[key] || key;
}

function lookupList(
  locale: EnumLocale,
  path: readonly string[],
  keys: readonly string[] | undefined,
): string[] | undefined {
  if (!keys || keys.length === 0) return undefined;
  return keys.map((k) => lookup(locale, path, k) ?? k);
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
  return lookupList(locale, ['units', 'orientation'], keys);
}

export function translatePropertyCondition(
  key: string | undefined,
  locale: EnumLocale = 'el'
): string | undefined {
  return lookup(locale, ['condition'], key);
}

export function translateCommercialStatus(
  key: string | undefined,
  locale: EnumLocale = 'el'
): string | undefined {
  return lookup(locale, ['commercialStatus'], key);
}

export function translateOperationalStatus(
  key: string | undefined,
  locale: EnumLocale = 'el'
): string | undefined {
  return lookup(locale, ['operationalStatus'], key);
}

export function translateHeatingType(
  key: string | undefined,
  locale: EnumLocale = 'el'
): string | undefined {
  return lookup(locale, ['systems', 'heating'], key);
}

export function translateCoolingType(
  key: string | undefined,
  locale: EnumLocale = 'el'
): string | undefined {
  return lookup(locale, ['systems', 'cooling'], key);
}

export function translateFlooring(
  keys: readonly string[] | undefined,
  locale: EnumLocale = 'el'
): string[] | undefined {
  return lookupList(locale, ['finishes', 'flooring'], keys);
}

export function translateWindowFrames(
  key: string | undefined,
  locale: EnumLocale = 'el'
): string | undefined {
  return lookup(locale, ['finishes', 'frames'], key);
}

export function translateGlazing(
  key: string | undefined,
  locale: EnumLocale = 'el'
): string | undefined {
  return lookup(locale, ['finishes', 'glazing'], key);
}

export function translateInteriorFeatures(
  keys: readonly string[] | undefined,
  locale: EnumLocale = 'el'
): string[] | undefined {
  return lookupList(locale, ['features', 'interior'], keys);
}

export function translateSecurityFeatures(
  keys: readonly string[] | undefined,
  locale: EnumLocale = 'el'
): string[] | undefined {
  return lookupList(locale, ['features', 'security'], keys);
}
