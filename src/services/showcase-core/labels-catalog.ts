/**
 * =============================================================================
 * SHOWCASE CORE — Label catalog access + enum translators (ADR-700)
 * =============================================================================
 *
 * The two pieces of boilerplate that survived ADR-321's `labels-shared`
 * extraction, because that round centralised the *fallback strings* but left
 * the *mechanics* copied into all five loaders:
 *
 *   1. **Catalog preamble** — `type ElShowcase = typeof elShowcase`, the
 *      `CATALOGS` record, the double cast onto the surface's namespace, and
 *      the five `?? {}` section extractions. Identical in building / parking /
 *      project / property / storage.
 *   2. **Enum translators** — ten `translateXxxYyy` functions whose bodies are
 *      byte-identical modulo the map they close over.
 *
 * The **label maps themselves stay in the surface files**: they are data, and
 * repeating data is not duplication. Only the code around them moves here.
 *
 * ⚠️ No `import 'server-only'` here on purpose — parking/storage labels declare
 * it, building/project/property do not. Adding it centrally would newly
 * constrain three modules that never asked for the restriction.
 *
 * @module services/showcase-core/labels-catalog
 * @see adrs/ADR-700-showcase-snapshot-primitives.md
 */

import elShowcase from '@/i18n/locales/el/showcase.json';
import enShowcase from '@/i18n/locales/en/showcase.json';
import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';
import {
  resolveHeaderContactLabels,
  showcaseFloorplansTitleDefault,
  showcasePhotosTitleDefault,
  type ShowcaseHeaderLabels,
} from './labels-shared';

// =============================================================================
// Enum translators
// =============================================================================

export interface ShowcaseEnumTranslator {
  (value: string | undefined, locale: EnumLocale): string | undefined;
}

/**
 * Turn a locale→key→label map into the translator every showcase surface used
 * to hand-write.
 *
 * Falsy input yields `undefined`; an unmapped key falls through to the raw
 * value, so an enum member added to Firestore before its label lands still
 * renders something rather than blanking the PDF row.
 */
export function createEnumLabelTranslator<K extends string>(
  labels: Record<EnumLocale, Record<K, string>>,
): ShowcaseEnumTranslator {
  return (value, locale) => {
    if (!value) return undefined;
    const map = labels[locale] as Record<string, string>;
    return map[value] ?? value;
  };
}

// =============================================================================
// Catalog access
// =============================================================================

type ShowcaseCatalog = typeof elShowcase;

const CATALOGS: Record<EnumLocale, ShowcaseCatalog> = {
  el: elShowcase as ShowcaseCatalog,
  en: enShowcase as unknown as ShowcaseCatalog,
};

export interface ShowcaseCatalogSections {
  specs: Record<string, string>;
  email: Record<string, string>;
  header: Record<string, string>;
  photos: Record<string, string>;
  floorplans: Record<string, string>;
  /** Catalog-level `header.contacts`, shared by every surface. */
  headerContacts: Record<string, string> | undefined;
  /** The whole namespace block, for surfaces reading sections beyond the five. */
  namespace: Record<string, unknown>;
}

/**
 * Read one surface's namespace out of `locales/{el,en}/showcase.json`.
 *
 * Every section defaults to `{}` so callers can apply their `?? fb(...)`
 * fallbacks against a plain record without null checks — a missing namespace
 * degrades to all-fallbacks, never to a throw.
 */
export function readShowcaseCatalogSections(
  namespaceKey: string,
  locale: EnumLocale,
): ShowcaseCatalogSections {
  const catalog = CATALOGS[locale];
  const namespace =
    (catalog as unknown as Record<string, Record<string, unknown> | undefined>)[
      namespaceKey
    ] ?? {};
  const section = (key: string): Record<string, string> =>
    (namespace[key] ?? {}) as Record<string, string>;

  return {
    specs: section('specs'),
    email: section('email'),
    header: section('header'),
    photos: section('photos'),
    floorplans: section('floorplans'),
    headerContacts: (catalog as unknown as {
      header?: { contacts?: Record<string, string> };
    }).header?.contacts,
    namespace,
  };
}

// =============================================================================
// Shared tail blocks — identical in all five loaders
// =============================================================================

/** `{ photos: { title }, floorplans: { title } }` with the shared defaults. */
export function resolveShowcaseMediaTitles(
  sections: ShowcaseCatalogSections,
  locale: EnumLocale,
): { photos: { title: string }; floorplans: { title: string } } {
  return {
    photos: { title: sections.photos.title ?? showcasePhotosTitleDefault(locale) },
    floorplans: {
      title: sections.floorplans.title ?? showcaseFloorplansTitleDefault(locale),
    },
  };
}

/**
 * Header block: the surface owns only its subtitle wording; the five contact
 * labels come from the catalog-level shared block.
 */
export function resolveShowcaseHeaderLabels(
  sections: ShowcaseCatalogSections,
  locale: EnumLocale,
  subtitleFallback: string,
): ShowcaseHeaderLabels {
  return {
    subtitle: sections.header.subtitle ?? subtitleFallback,
    contacts: resolveHeaderContactLabels(sections.headerContacts, locale),
  };
}
