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

import elShowcase from '@/i18n/locales/el/showcase.json';
import enShowcase from '@/i18n/locales/en/showcase.json';
import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';
import {
  createLocaleFallback,
  resolveHeaderContactLabels,
  showcaseCtaLabelDefault,
  showcaseFloorplansTitleDefault,
  showcasePhotosTitleDefault,
  type ShowcaseHeaderContactLabels,
  type ShowcaseHeaderLabels,
} from '@/services/showcase-core/labels-shared';
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

export function translateParkingType(
  type: string | undefined,
  locale: EnumLocale,
): string | undefined {
  if (!type) return undefined;
  const map = PARKING_TYPE_LABELS[locale] as Record<string, string>;
  return map[type] ?? type;
}

export function translateParkingStatus(
  status: string | undefined,
  locale: EnumLocale,
): string | undefined {
  if (!status) return undefined;
  const map = PARKING_STATUS_LABELS[locale] as Record<string, string>;
  return map[status] ?? status;
}

export function translateParkingZone(
  zone: string | undefined,
  locale: EnumLocale,
): string | undefined {
  if (!zone) return undefined;
  const map = PARKING_ZONE_LABELS[locale] as Record<string, string>;
  return map[zone] ?? zone;
}

// ============================================================================
// LABEL TYPES
// ============================================================================

export interface ParkingShowcaseSpecLabels {
  title: string;
  code: string;
  type: string;
  status: string;
  area: string;
  price: string;
  floor: string;
  building: string;
  locationZone: string;
  areaUnit: string;
}

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

type ElShowcase = typeof elShowcase;
const CATALOGS: Record<EnumLocale, ElShowcase> = {
  el: elShowcase as ElShowcase,
  en: enShowcase as unknown as ElShowcase,
};

export function loadParkingShowcasePdfLabels(
  locale: EnumLocale = 'el',
): ParkingShowcasePDFLabels {
  const c = CATALOGS[locale];
  const ps = (c as unknown as { parkingShowcase?: Record<string, unknown> }).parkingShowcase ?? {};

  const specs      = (ps.specs     ?? {}) as Record<string, string>;
  const emailData  = (ps.email     ?? {}) as Record<string, string>;
  const header     = (ps.header    ?? {}) as Record<string, string>;
  const photos     = (ps.photos    ?? {}) as Record<string, string>;
  const floorplans = (ps.floorplans ?? {}) as Record<string, string>;
  const headerContacts = (c as unknown as { header?: { contacts?: Record<string, string> } })
    .header?.contacts;

  const fb = createLocaleFallback(locale);

  return {
    specs: {
      title:        specs.title        ?? fb('Στοιχεία Θέσης Στάθμευσης', 'Parking Spot Details'),
      code:         specs.code         ?? fb('Κωδικός', 'Code'),
      type:         specs.type         ?? fb('Τύπος', 'Type'),
      status:       specs.status       ?? fb('Κατάσταση', 'Status'),
      area:         specs.area         ?? fb('Εμβαδόν', 'Area'),
      price:        specs.price        ?? fb('Τιμή', 'Price'),
      floor:        specs.floor        ?? fb('Όροφος', 'Floor'),
      building:     specs.building     ?? fb('Κτήριο', 'Building'),
      locationZone: specs.locationZone ?? fb('Ζώνη', 'Zone'),
      areaUnit:     specs.areaUnit     ?? 'm²',
    },
    email: {
      subjectPrefix: emailData.subjectPrefix ?? fb('Παρουσίαση Θέσης Στάθμευσης', 'Parking Spot Showcase'),
      introText:     emailData.introText     ?? fb(
        'Σας προωθούμε την αναλυτική παρουσίαση της θέσης στάθμευσης.',
        'We are sharing the detailed presentation of the parking spot.',
      ),
      ctaLabel: emailData.ctaLabel ?? showcaseCtaLabelDefault(locale),
    },
    header: {
      subtitle: (header.subtitle as string | undefined) ?? fb('Παρουσίαση θέσης στάθμευσης', 'Parking spot showcase'),
      contacts: resolveHeaderContactLabels(headerContacts, locale),
    },
    photos:     { title: photos.title      ?? showcasePhotosTitleDefault(locale) },
    floorplans: { title: floorplans.title  ?? showcaseFloorplansTitleDefault(locale) },
  };
}
