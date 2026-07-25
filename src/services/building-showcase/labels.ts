/**
 * Building Showcase PDF labels — server-side i18n SSoT (ADR-320 + ADR-321 Phase 2).
 *
 * Reads `src/i18n/locales/{el,en}/showcase.json` → `buildingShowcase` namespace
 * so the PDF generator never duplicates localised strings.
 *
 * Building-specific enum label maps stay inline (BUILDING_TYPE_LABELS /
 * BUILDING_STATUS_LABELS / RENOVATION_STATUS_LABELS). Chrome / email / header
 * fallbacks are delegated to `showcase-core/labels-shared` so all three
 * showcases share a single source of truth.
 *
 * @module services/building-showcase/labels
 */

import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';
import {
  createLocaleFallback,
  type ShowcaseHeaderContactLabels,
  type ShowcaseHeaderLabels,
} from '@/services/showcase-core/labels-shared';
import {
  createEnumLabelTranslator,
  readShowcaseCatalogSections,
  resolveShowcaseChromeLabels,
  resolveShowcaseDescriptionLabels,
  resolveShowcaseEmailLabels,
  resolveShowcaseHeaderLabels,
  resolveShowcaseMediaTitles,
  resolveShowcaseSpecLabels,
} from '@/services/showcase-core/labels-catalog';
import type { BuildingType } from '@/constants/building-types';
import type { BuildingStatus } from '@/constants/building-statuses';
import type { RenovationStatus } from '@/constants/renovation-statuses';

// ============================================================================
// ENUM LABEL MAPS (inline — SSoT arrays imported from @/constants/*)
// ============================================================================

const BUILDING_TYPE_LABELS: Record<EnumLocale, Record<BuildingType, string>> = {
  el: {
    residential: 'Κατοικίες',
    commercial: 'Εμπορικό',
    industrial: 'Βιομηχανικό',
    mixed: 'Μικτή χρήση',
    office: 'Γραφεία',
    warehouse: 'Αποθήκη',
  },
  en: {
    residential: 'Residential',
    commercial: 'Commercial',
    industrial: 'Industrial',
    mixed: 'Mixed use',
    office: 'Office',
    warehouse: 'Warehouse',
  },
};

const BUILDING_STATUS_LABELS: Record<EnumLocale, Record<BuildingStatus, string>> = {
  el: {
    planning: 'Σχεδιασμός',
    construction: 'Υπό κατασκευή',
    completed: 'Ολοκληρωμένο',
    active: 'Ενεργό',
    deleted: 'Διαγραμμένο',
  },
  en: {
    planning: 'Planning',
    construction: 'Under construction',
    completed: 'Completed',
    active: 'Active',
    deleted: 'Deleted',
  },
};

const RENOVATION_STATUS_LABELS: Record<EnumLocale, Record<RenovationStatus, string>> = {
  el: {
    none: 'Χωρίς ανακαίνιση',
    partial: 'Μερική ανακαίνιση',
    full: 'Πλήρης ανακαίνιση',
    planned: 'Προγραμματισμένη',
  },
  en: {
    none: 'No renovation',
    partial: 'Partial renovation',
    full: 'Full renovation',
    planned: 'Planned',
  },
};

export const translateBuildingType = createEnumLabelTranslator(BUILDING_TYPE_LABELS);
export const translateBuildingStatus = createEnumLabelTranslator(BUILDING_STATUS_LABELS);
export const translateRenovationStatus = createEnumLabelTranslator(RENOVATION_STATUS_LABELS);

// ============================================================================
// PDF LABEL TYPES
// ============================================================================


/** Spec rows this surface renders, in display order (ADR-701). */
const BUILDING_SPEC_ROWS = [
  'code',
  'type',
  'status',
  'progress',
  'totalArea',
  'builtArea',
  'floors',
  'units',
  'totalValue',
  'energyClass',
  'renovation',
  'constructionYear',
  'startDate',
  'completionDate',
  'location',
  'project',
  'linkedCompany',
] as const;

export type BuildingShowcaseSpecLabels = Record<
  (typeof BUILDING_SPEC_ROWS)[number] | 'title' | 'areaUnit',
  string
>;

export interface BuildingShowcaseDescriptionLabels {
  sectionTitle: string;
}

export interface BuildingShowcasePhotosLabels {
  title: string;
}

export interface BuildingShowcaseFloorplansLabels {
  title: string;
}

export interface BuildingShowcasePdfChrome {
  title: string;
  generatedOn: string;
  descriptionSection: string;
  footerNote: string;
  photosTitle: string;
  floorplansTitle: string;
  poweredBy: string;
}

export interface BuildingShowcaseEmailLabels {
  subjectPrefix: string;
  introText: string;
  ctaLabel: string;
}

export type BuildingShowcaseHeaderLabels = ShowcaseHeaderLabels;

export interface BuildingShowcasePDFLabels {
  specs: BuildingShowcaseSpecLabels;
  description: BuildingShowcaseDescriptionLabels;
  photos: BuildingShowcasePhotosLabels;
  floorplans: BuildingShowcaseFloorplansLabels;
  chrome: BuildingShowcasePdfChrome;
  email: BuildingShowcaseEmailLabels;
  header: BuildingShowcaseHeaderLabels;
}

export type { ShowcaseHeaderContactLabels };

// ============================================================================
// LOADER
// ============================================================================

export function loadBuildingShowcasePdfLabels(
  locale: EnumLocale = 'el',
): BuildingShowcasePDFLabels {
  const sections = readShowcaseCatalogSections('buildingShowcase', locale);
  const fb = createLocaleFallback(locale);

  return {
    specs: resolveShowcaseSpecLabels(sections, locale, {
      title: fb('Στοιχεία Κτηρίου', 'Building Details'),
      keys: BUILDING_SPEC_ROWS,
    }),
    description: resolveShowcaseDescriptionLabels(sections, locale),
    ...resolveShowcaseMediaTitles(sections, locale),
    chrome: resolveShowcaseChromeLabels(sections, locale, {
      title: fb('Παρουσίαση Κτηρίου', 'Building Showcase'),
      footerNote: fb('Παρουσίαση κτηρίου', 'Building showcase'),
    }),
    email: resolveShowcaseEmailLabels(sections, locale, {
      subjectPrefix: fb('Παρουσίαση Κτηρίου', 'Building Showcase'),
      introText: fb(
        'Σας προωθούμε την αναλυτική παρουσίαση του κτηρίου.',
        'We are sharing the detailed presentation of the building.',
      ),
    }),
    header: resolveShowcaseHeaderLabels(
      sections,
      locale,
      fb('Παρουσίαση κτηρίου', 'Building showcase'),
    ),
  };
}
