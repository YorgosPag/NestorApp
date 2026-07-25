/**
 * Parking Showcase labels — server-side i18n SSoT (ADR-315 + ADR-321 pattern).
 *
 * Reads `src/i18n/locales/{el,en}/showcase.json` → `parkingShowcase` namespace.
 * Enum label maps (type / status / locationZone) stay inline.
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
  createEnumLabelTranslator,
  readShowcaseCatalogSections,
  resolveShowcaseEmailLabels,
  resolveShowcaseHeaderLabels,
  resolveShowcaseMediaTitles,
  resolveShowcaseSpecLabels,
} from '@/services/showcase-core/labels-catalog';
import type { ParkingSpotType, ParkingSpotStatus, ParkingLocationZone } from '@/types/parking';

// ============================================================================
// ENUM LABEL MAPS
// ============================================================================

const PARKING_TYPE_LABELS: Record<EnumLocale, Record<ParkingSpotType, string>> = {
  el: {
    standard:    'Κανονική',
    handicapped: 'ΑΜΕΑ',
    motorcycle:  'Μοτοσυκλέτα',
    electric:    'Ηλεκτρικό',
    visitor:     'Επισκέπτης',
  },
  en: {
    standard:    'Standard',
    handicapped: 'Handicapped',
    motorcycle:  'Motorcycle',
    electric:    'Electric',
    visitor:     'Visitor',
  },
};

const PARKING_STATUS_LABELS: Record<EnumLocale, Record<ParkingSpotStatus, string>> = {
  el: {
    available:   'Διαθέσιμη',
    occupied:    'Κατειλημμένη',
    reserved:    'Δεσμευμένη',
    sold:        'Πουλήθηκε',
    maintenance: 'Συντήρηση',
    deleted:     'Διαγραμμένη',
  },
  en: {
    available:   'Available',
    occupied:    'Occupied',
    reserved:    'Reserved',
    sold:        'Sold',
    maintenance: 'Maintenance',
    deleted:     'Deleted',
  },
};

const PARKING_ZONE_LABELS: Record<EnumLocale, Record<ParkingLocationZone, string>> = {
  el: {
    pilotis:         'Πιλοτή',
    underground:     'Υπόγειο',
    open_space:      'Υπαίθριο',
    rooftop:         'Ταράτσα',
    covered_outdoor: 'Υπαίθριο σκεπαστό',
  },
  en: {
    pilotis:         'Pilotis',
    underground:     'Underground',
    open_space:      'Open space',
    rooftop:         'Rooftop',
    covered_outdoor: 'Covered outdoor',
  },
};

export const translateParkingType = createEnumLabelTranslator(PARKING_TYPE_LABELS);
export const translateParkingStatus = createEnumLabelTranslator(PARKING_STATUS_LABELS);
export const translateParkingZone = createEnumLabelTranslator(PARKING_ZONE_LABELS);

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
