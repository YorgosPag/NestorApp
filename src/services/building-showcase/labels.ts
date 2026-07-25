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
  showcaseCtaLabelDefault,
  showcaseDescriptionSectionDefault,
  showcaseGeneratedOnDefault,
  showcasePoweredByDefault,
  type ShowcaseHeaderContactLabels,
  type ShowcaseHeaderLabels,
} from '@/services/showcase-core/labels-shared';
import {
  createEnumLabelTranslator,
  readShowcaseCatalogSections,
  resolveShowcaseHeaderLabels,
  resolveShowcaseMediaTitles,
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


export interface BuildingShowcaseSpecLabels {
  title: string;
  code: string;
  type: string;
  status: string;
  progress: string;
  totalArea: string;
  builtArea: string;
  floors: string;
  units: string;
  totalValue: string;
  energyClass: string;
  renovation: string;
  constructionYear: string;
  startDate: string;
  completionDate: string;
  location: string;
  project: string;
  linkedCompany: string;
  areaUnit: string;
}

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
  const { specs, email, namespace } = sections;
  const description = (namespace.description ?? {}) as Record<string, string>;
  const pdf = (namespace.pdf ?? {}) as Record<string, string>;

  const fb = createLocaleFallback(locale);
  const media = resolveShowcaseMediaTitles(sections, locale);
  const photosTitle = media.photos.title;
  const floorplansTitle = media.floorplans.title;

  return {
    specs: {
      title:             specs.title             ?? fb('Στοιχεία Κτηρίου', 'Building Details'),
      code:              specs.code              ?? fb('Κωδικός', 'Code'),
      type:              specs.type              ?? fb('Τύπος', 'Type'),
      status:            specs.status            ?? fb('Κατάσταση', 'Status'),
      progress:          specs.progress          ?? fb('Πρόοδος', 'Progress'),
      totalArea:         specs.totalArea         ?? fb('Συνολικό εμβαδόν', 'Total area'),
      builtArea:         specs.builtArea         ?? fb('Δομημένη επιφάνεια', 'Built area'),
      floors:            specs.floors            ?? fb('Όροφοι', 'Floors'),
      units:             specs.units             ?? fb('Μονάδες', 'Units'),
      totalValue:        specs.totalValue        ?? fb('Συνολική αξία', 'Total value'),
      energyClass:       specs.energyClass       ?? fb('Ενεργειακή κλάση', 'Energy class'),
      renovation:        specs.renovation        ?? fb('Ανακαίνιση', 'Renovation'),
      constructionYear:  specs.constructionYear  ?? fb('Έτος κατασκευής', 'Construction year'),
      startDate:         specs.startDate         ?? fb('Έναρξη', 'Start date'),
      completionDate:    specs.completionDate    ?? fb('Παράδοση', 'Completion date'),
      location:          specs.location          ?? fb('Τοποθεσία', 'Location'),
      project:           specs.project           ?? fb('Έργο', 'Project'),
      linkedCompany:     specs.linkedCompany     ?? fb('Συνεργαζόμενη εταιρεία', 'Linked company'),
      areaUnit:          specs.areaUnit          ?? 'm²',
    },
    description: {
      sectionTitle: description.sectionTitle ?? showcaseDescriptionSectionDefault(locale),
    },
    photos: media.photos,
    floorplans: media.floorplans,
    chrome: {
      title:              pdf.title              ?? fb('Παρουσίαση Κτηρίου', 'Building Showcase'),
      generatedOn:        pdf.generatedOn        ?? showcaseGeneratedOnDefault(locale),
      descriptionSection: pdf.descriptionSection ?? showcaseDescriptionSectionDefault(locale),
      footerNote:         pdf.footerNote         ?? fb('Παρουσίαση κτηρίου', 'Building showcase'),
      photosTitle,
      floorplansTitle,
      poweredBy:          showcasePoweredByDefault(locale),
    },
    email: {
      subjectPrefix: email.subjectPrefix ?? fb('Παρουσίαση Κτηρίου', 'Building Showcase'),
      introText:     email.introText     ?? fb(
        'Σας προωθούμε την αναλυτική παρουσίαση του κτηρίου.',
        'We are sharing the detailed presentation of the building.',
      ),
      ctaLabel:      email.ctaLabel      ?? showcaseCtaLabelDefault(locale),
    },
    header: resolveShowcaseHeaderLabels(
      sections,
      locale,
      fb('Παρουσίαση κτηρίου', 'Building showcase'),
    ),
  };
}
