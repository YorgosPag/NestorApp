/**
 * Parking Showcase labels — server-side i18n SSoT (ADR-315 + ADR-321 pattern).
 *
 * Reads `src/i18n/locales/{el,en}/showcase.json` → `parkingShowcase` namespace.
 * Enum labels (type / locationZone) come from `parking.json` — the SAME keys as the UI (ADR-903 §6).
 * Chrome/email/header fallbacks delegate to `showcase-core/labels-shared`.
 *
 * @module services/parking-showcase/labels
 */

import 'server-only';

import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';
import {
  createLocaleFallback,
  type ShowcaseHeaderContactLabels,
  type ShowcaseHeaderLabels,
} from '@/services/showcase-core/labels-shared';
import {
  readShowcaseCatalogSections,
  type ShowcaseEnumTranslator,
  resolveShowcaseEmailLabels,
  resolveShowcaseHeaderLabels,
  resolveShowcaseMediaTitles,
  resolveShowcaseSpecLabels,
} from '@/services/showcase-core/labels-catalog';
import { PARKING_LOCATION_ZONES, PARKING_TYPES } from '@/types/parking';
import elParking from '@/i18n/locales/el/parking.json';
import enParking from '@/i18n/locales/en/parking.json';
import { createBundleTranslate, type BundleTranslate } from '@/i18n/bundle-translate';

// ============================================================================
// ENUM LABELS
// ============================================================================

/**
 * ADR-903 §6 (N.0.2) — είδος θέσης και ζώνη από το **ίδιο** `parking.json` με την οθόνη, στη γλώσσα του
 * παραλήπτη (`createBundleTranslate`, πρότυπο `floor-label-bundle`). Ως τις 2026-10-03 ζούσαν εδώ χειρόγραφοι
 * πίνακες που **απέκλιναν** από την οθόνη («Πιλοτή»/«Ταράτσα» αντί για «Πυλωτή»/«Δώμα»).
 * Άγνωστη τιμή ⇒ αυτούσια (ίδιο συμβόλαιο με το `createEnumLabelTranslator`).
 */
const PARKING_BUNDLES: Readonly<Record<EnumLocale, BundleTranslate>> = {
  el: createBundleTranslate({ parking: elParking }, 'parking', 'el'),
  en: createBundleTranslate({ parking: enParking }, 'parking', 'en'),
};

function parkingEnumTranslator(prefix: 'types' | 'locationZone', values: readonly string[]): ShowcaseEnumTranslator {
  return (value, locale) => {
    if (!value) return undefined;
    return values.includes(value) ? PARKING_BUNDLES[locale](`${prefix}.${value}`) : value;
  };
}

export const translateParkingType = parkingEnumTranslator('types', PARKING_TYPES);
export const translateParkingZone = parkingEnumTranslator('locationZone', PARKING_LOCATION_ZONES);

// ============================================================================
// LABEL TYPES
// ============================================================================

/** Spec rows this surface renders, in display order (ADR-701). */
const PARKING_SPEC_ROWS = [
  'code',
  'type',
  'status',
  'area',
  'price',
  'floor',
  'building',
  'locationZone',
] as const;

export type ParkingShowcaseSpecLabels = Record<
  (typeof PARKING_SPEC_ROWS)[number] | 'title' | 'areaUnit',
  string
>;

export interface ParkingShowcaseEmailLabels {
  subjectPrefix: string;
  introText: string;
  ctaLabel: string;
}

export interface ParkingShowcasePDFLabels {
  specs: ParkingShowcaseSpecLabels;
  email: ParkingShowcaseEmailLabels;
  header: ShowcaseHeaderLabels;
  photos: { title: string };
  floorplans: { title: string };
}

export type { ShowcaseHeaderContactLabels };

// ============================================================================
// LOADER
// ============================================================================

export function loadParkingShowcasePdfLabels(
  locale: EnumLocale = 'el',
): ParkingShowcasePDFLabels {
  const sections = readShowcaseCatalogSections('parkingShowcase', locale);
  const fb = createLocaleFallback(locale);

  return {
    specs: resolveShowcaseSpecLabels(sections, locale, {
      title: fb('Στοιχεία Θέσης Στάθμευσης', 'Parking Spot Details'),
      keys: PARKING_SPEC_ROWS,
    }),
    email: resolveShowcaseEmailLabels(sections, locale, {
      subjectPrefix: fb('Παρουσίαση Θέσης Στάθμευσης', 'Parking Spot Showcase'),
      introText: fb(
        'Σας προωθούμε την αναλυτική παρουσίαση της θέσης στάθμευσης.',
        'We are sharing the detailed presentation of the parking spot.',
      ),
    }),
    header: resolveShowcaseHeaderLabels(
      sections,
      locale,
      fb('Παρουσίαση θέσης στάθμευσης', 'Parking spot showcase'),
    ),
    ...resolveShowcaseMediaTitles(sections, locale),
  };
}
