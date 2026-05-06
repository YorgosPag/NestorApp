/**
 * Storage Showcase labels — server-side i18n SSoT (ADR-315 + ADR-321 pattern).
 *
 * Reads `src/i18n/locales/{el,en}/showcase.json` → `storageShowcase` namespace.
 * Enum label maps (type / status) stay inline.
 * Chrome/email/header fallbacks delegate to `showcase-core/labels-shared`.
 *
 * @module services/storage-showcase/labels
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
import type { StorageType, StorageStatus } from '@/types/storage/contracts';

// ============================================================================
// ENUM LABEL MAPS
// ============================================================================

const STORAGE_TYPE_LABELS: Record<EnumLocale, Record<StorageType, string>> = {
  el: {
    storage:   'Αποθήκη',
    large:     'Μεγάλη αποθήκη',
    small:     'Μικρή αποθήκη',
    basement:  'Υπόγεια αποθήκη',
    ground:    'Ισόγεια αποθήκη',
    special:   'Ειδική αποθήκη',
    parking:   'Πάρκινγκ',
    garage:    'Γκαράζ',
    warehouse: 'Αποθηκευτικός χώρος',
  },
  en: {
    storage:   'Storage',
    large:     'Large storage',
    small:     'Small storage',
    basement:  'Basement storage',
    ground:    'Ground floor storage',
    special:   'Special storage',
    parking:   'Parking',
    garage:    'Garage',
    warehouse: 'Warehouse',
  },
};

const STORAGE_STATUS_LABELS: Record<EnumLocale, Record<StorageStatus, string>> = {
  el: {
    available:   'Διαθέσιμη',
    occupied:    'Κατειλημμένη',
    maintenance: 'Συντήρηση',
    reserved:    'Δεσμευμένη',
    sold:        'Πουλήθηκε',
    unavailable: 'Μη διαθέσιμη',
    deleted:     'Διαγραμμένη',
  },
  en: {
    available:   'Available',
    occupied:    'Occupied',
    maintenance: 'Maintenance',
    reserved:    'Reserved',
    sold:        'Sold',
    unavailable: 'Unavailable',
    deleted:     'Deleted',
  },
};

export function translateStorageType(
  type: string | undefined,
  locale: EnumLocale,
): string | undefined {
  if (!type) return undefined;
  const map = STORAGE_TYPE_LABELS[locale] as Record<string, string>;
  return map[type] ?? type;
}

export function translateStorageStatus(
  status: string | undefined,
  locale: EnumLocale,
): string | undefined {
  if (!status) return undefined;
  const map = STORAGE_STATUS_LABELS[locale] as Record<string, string>;
  return map[status] ?? status;
}

// ============================================================================
// LABEL TYPES
// ============================================================================

export interface StorageShowcaseSpecLabels {
  title: string;
  code: string;
  type: string;
  status: string;
  area: string;
  price: string;
  floor: string;
  building: string;
  areaUnit: string;
}

export interface StorageShowcaseEmailLabels {
  subjectPrefix: string;
  introText: string;
  ctaLabel: string;
}

export interface StorageShowcasePDFLabels {
  specs: StorageShowcaseSpecLabels;
  email: StorageShowcaseEmailLabels;
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

export function loadStorageShowcasePdfLabels(
  locale: EnumLocale = 'el',
): StorageShowcasePDFLabels {
  const c = CATALOGS[locale];
  const ss = (c as unknown as { storageShowcase?: Record<string, unknown> }).storageShowcase ?? {};

  const specs     = (ss.specs    ?? {}) as Record<string, string>;
  const emailData = (ss.email    ?? {}) as Record<string, string>;
  const header    = (ss.header   ?? {}) as Record<string, string>;
  const photos    = (ss.photos   ?? {}) as Record<string, string>;
  const floorplans= (ss.floorplans ?? {}) as Record<string, string>;
  const headerContacts = (c as unknown as { header?: { contacts?: Record<string, string> } })
    .header?.contacts;

  const fb = createLocaleFallback(locale);

  return {
    specs: {
      title:    specs.title    ?? fb('Στοιχεία Αποθήκης', 'Storage Details'),
      code:     specs.code     ?? fb('Κωδικός', 'Code'),
      type:     specs.type     ?? fb('Τύπος', 'Type'),
      status:   specs.status   ?? fb('Κατάσταση', 'Status'),
      area:     specs.area     ?? fb('Εμβαδόν', 'Area'),
      price:    specs.price    ?? fb('Τιμή', 'Price'),
      floor:    specs.floor    ?? fb('Όροφος', 'Floor'),
      building: specs.building ?? fb('Κτήριο', 'Building'),
      areaUnit: specs.areaUnit ?? 'm²',
    },
    email: {
      subjectPrefix: emailData.subjectPrefix ?? fb('Παρουσίαση Αποθήκης', 'Storage Showcase'),
      introText:     emailData.introText     ?? fb(
        'Σας προωθούμε την αναλυτική παρουσίαση της αποθήκης.',
        'We are sharing the detailed presentation of the storage unit.',
      ),
      ctaLabel: emailData.ctaLabel ?? showcaseCtaLabelDefault(locale),
    },
    header: {
      subtitle: (header.subtitle as string | undefined) ?? fb('Παρουσίαση αποθήκης', 'Storage showcase'),
      contacts: resolveHeaderContactLabels(headerContacts, locale),
    },
    photos:    { title: photos.title      ?? showcasePhotosTitleDefault(locale) },
    floorplans:{ title: floorplans.title  ?? showcaseFloorplansTitleDefault(locale) },
  };
}
