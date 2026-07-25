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

/** Spec rows this surface renders, in display order (ADR-701). */
const STORAGE_SPEC_ROWS = [
  'code',
  'type',
  'status',
  'area',
  'price',
  'floor',
  'building',
] as const;

export type StorageShowcaseSpecLabels = Record<
  (typeof STORAGE_SPEC_ROWS)[number] | 'title' | 'areaUnit',
  string
>;

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
  const fb = createLocaleFallback(locale);

  return {
    specs: resolveShowcaseSpecLabels(sections, locale, {
      title: fb('Στοιχεία Αποθήκης', 'Storage Details'),
      keys: STORAGE_SPEC_ROWS,
    }),
    email: resolveShowcaseEmailLabels(sections, locale, {
      subjectPrefix: fb('Παρουσίαση Αποθήκης', 'Storage Showcase'),
      introText: fb(
        'Σας προωθούμε την αναλυτική παρουσίαση της αποθήκης.',
        'We are sharing the detailed presentation of the storage unit.',
      ),
    }),
    header: resolveShowcaseHeaderLabels(
      sections,
      locale,
      fb('Παρουσίαση αποθήκης', 'Storage showcase'),
    ),
    ...resolveShowcaseMediaTitles(sections, locale),
  };
}
