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

import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';
import {
  createLocaleFallback,
  showcaseCtaLabelDefault,
  type ShowcaseHeaderContactLabels,
  type ShowcaseHeaderLabels,
} from '@/services/showcase-core/labels-shared';
import {
  createEnumLabelTranslator,
  readShowcaseCatalogSections,
  resolveShowcaseHeaderLabels,
  resolveShowcaseMediaTitles,
} from '@/services/showcase-core/labels-catalog';
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

export const translateStorageType = createEnumLabelTranslator(STORAGE_TYPE_LABELS);
export const translateStorageStatus = createEnumLabelTranslator(STORAGE_STATUS_LABELS);

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

export function loadStorageShowcasePdfLabels(
  locale: EnumLocale = 'el',
): StorageShowcasePDFLabels {
  const sections = readShowcaseCatalogSections('storageShowcase', locale);
  const { specs, email } = sections;
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
      subjectPrefix: email.subjectPrefix ?? fb('Παρουσίαση Αποθήκης', 'Storage Showcase'),
      introText:     email.introText     ?? fb(
        'Σας προωθούμε την αναλυτική παρουσίαση της αποθήκης.',
        'We are sharing the detailed presentation of the storage unit.',
      ),
      ctaLabel: email.ctaLabel ?? showcaseCtaLabelDefault(locale),
    },
    header: resolveShowcaseHeaderLabels(
      sections,
      locale,
      fb('Παρουσίαση αποθήκης', 'Storage showcase'),
    ),
    ...resolveShowcaseMediaTitles(sections, locale),
  };
}
