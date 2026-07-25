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
  showcaseCtaLabelDefault,
  showcaseDescriptionSectionDefault,
  showcaseFloorplansTitleDefault,
  showcaseGeneratedOnDefault,
  showcasePhotosTitleDefault,
  showcasePoweredByDefault,
  type ShowcaseEmailLabels,
  type ShowcaseHeaderLabels,
  type ShowcasePdfChromeLabels,
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

/**
 * The whole `showcase.json` catalog for a locale.
 *
 * Four surfaces namespace their labels (`buildingShowcase`, `parkingShowcase`,
 * …) and should use {@link readShowcaseCatalogSections}. The property showcase
 * is the exception: it predates namespacing and keeps its sections at the
 * catalog **root** (`specs`, `pdf`, `views`, …), so it reads the catalog whole.
 */
export function getShowcaseCatalog(locale: EnumLocale): ShowcaseCatalog {
  return CATALOGS[locale];
}

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
 * Every spec-row label wording used by any showcase surface, as `[el, en]`.
 *
 * The five loaders each hand-wrote their own `specs.X ?? fb('…', '…')` ladder,
 * so the eleven rows they have in common carried five copies of the same two
 * strings. A surface now declares **which** rows it shows; the wording lives
 * here once. Adding a row to a surface is a one-word change to its key list.
 */
const SHOWCASE_SPEC_FALLBACKS: Record<string, readonly [string, string]> = {
  code:             ['Κωδικός', 'Code'],
  type:             ['Τύπος', 'Type'],
  status:           ['Κατάσταση', 'Status'],
  area:             ['Εμβαδόν', 'Area'],
  price:            ['Τιμή', 'Price'],
  floor:            ['Όροφος', 'Floor'],
  building:         ['Κτήριο', 'Building'],
  locationZone:     ['Ζώνη', 'Zone'],
  progress:         ['Πρόοδος', 'Progress'],
  totalArea:        ['Συνολικό εμβαδόν', 'Total area'],
  builtArea:        ['Δομημένη επιφάνεια', 'Built area'],
  floors:           ['Όροφοι', 'Floors'],
  units:            ['Μονάδες', 'Units'],
  totalValue:       ['Συνολική αξία', 'Total value'],
  energyClass:      ['Ενεργειακή κλάση', 'Energy class'],
  renovation:       ['Ανακαίνιση', 'Renovation'],
  constructionYear: ['Έτος κατασκευής', 'Construction year'],
  startDate:        ['Έναρξη', 'Start date'],
  completionDate:   ['Παράδοση', 'Completion date'],
  location:         ['Τοποθεσία', 'Location'],
  project:          ['Έργο', 'Project'],
  client:           ['Πελάτης', 'Client'],
  linkedCompany:    ['Συνεργαζόμενη εταιρεία', 'Linked company'],
};

/** Same glyph in both locales — the catalog may still override it per surface. */
const SPEC_AREA_UNIT_DEFAULT = 'm²';

/**
 * Resolve a surface's spec-row labels: catalog value first, shared wording
 * second.
 *
 * `title` stays a parameter because it is the one row whose wording is
 * genuinely surface-specific ("Στοιχεία Κτηρίου" vs "Στοιχεία Αποθήκης").
 * `areaUnit` is always emitted — every surface displays one.
 *
 * Key order in the result follows `keys`; these objects are read by key by the
 * PDF renderers, never serialised positionally.
 */
export function resolveShowcaseSpecLabels<K extends string>(
  sections: ShowcaseCatalogSections,
  locale: EnumLocale,
  spec: { title: string; keys: readonly K[] },
): { title: string; areaUnit: string } & Record<K, string> {
  const { specs } = sections;
  const resolved = {} as Record<K, string>;

  for (const key of spec.keys) {
    const fallback = SHOWCASE_SPEC_FALLBACKS[key];
    if (fallback === undefined) {
      throw new Error(
        `[showcase-core] No shared wording for spec row "${key}". `
        + 'Add it to SHOWCASE_SPEC_FALLBACKS in labels-catalog.ts (ADR-700).',
      );
    }
    resolved[key] = specs[key] ?? (locale === 'el' ? fallback[0] : fallback[1]);
  }

  return {
    title: specs.title ?? spec.title,
    ...resolved,
    areaUnit: specs.areaUnit ?? SPEC_AREA_UNIT_DEFAULT,
  };
}

/**
 * Email block. All four namespaced surfaces differ only in their subject and
 * intro wording; the CTA is shared.
 */
export function resolveShowcaseEmailLabels(
  sections: ShowcaseCatalogSections,
  locale: EnumLocale,
  fallbacks: { subjectPrefix: string; introText: string },
): ShowcaseEmailLabels {
  const { email } = sections;
  return {
    subjectPrefix: email.subjectPrefix ?? fallbacks.subjectPrefix,
    introText: email.introText ?? fallbacks.introText,
    ctaLabel: email.ctaLabel ?? showcaseCtaLabelDefault(locale),
  };
}

/**
 * PDF chrome block, for the two surfaces that render a full document frame
 * (building / project). Media titles are threaded through so the chrome
 * headings can never drift from the section headings they label.
 */
export function resolveShowcaseChromeLabels(
  sections: ShowcaseCatalogSections,
  locale: EnumLocale,
  fallbacks: { title: string; footerNote: string },
): ShowcasePdfChromeLabels {
  const pdf = (sections.namespace.pdf ?? {}) as Record<string, string>;
  const media = resolveShowcaseMediaTitles(sections, locale);
  return {
    title: pdf.title ?? fallbacks.title,
    generatedOn: pdf.generatedOn ?? showcaseGeneratedOnDefault(locale),
    descriptionSection:
      pdf.descriptionSection ?? showcaseDescriptionSectionDefault(locale),
    footerNote: pdf.footerNote ?? fallbacks.footerNote,
    photosTitle: media.photos.title,
    floorplansTitle: media.floorplans.title,
    poweredBy: showcasePoweredByDefault(locale),
  };
}

/** `description.sectionTitle` with the shared default — identical on both. */
export function resolveShowcaseDescriptionLabels(
  sections: ShowcaseCatalogSections,
  locale: EnumLocale,
): { sectionTitle: string } {
  const description = (sections.namespace.description ?? {}) as Record<string, string>;
  return {
    sectionTitle:
      description.sectionTitle ?? showcaseDescriptionSectionDefault(locale),
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
